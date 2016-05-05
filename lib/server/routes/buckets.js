'use strict';

const async = require('async');
const storj = require('storj');
const authenticate = require('../middleware').authenticate;
const tokenauth = require('../middleware').tokenauth;
const log = require('../../logger');
const merge = require('merge');
const errors = require('../errors');
const Router = require('./index');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all bucket and file related operations
 * @constructor
 * @extends {Router}
 * @param {Config} config
 * @param {Storage} storage
 * @param {Network} network
 * @param {Mailer} mailer
 */
function BucketsRouter(config, storage, network, mailer) {
  if (!(this instanceof BucketsRouter)) {
    return new BucketsRouter(config, network, storage, mailer);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
  this._usetoken = tokenauth(this.storage);
}

inherits(BucketsRouter, Router);

/**
 * Returns a list of buckets for the user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.getBuckets = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;

  log.info('looking up buckets for %s', req.user._id);

  Bucket.find({ user: req.user._id }, function(err, buckets) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.status(200).send(buckets.map(function(bucket) {
      return bucket.toObject();
    }));
  });
};

/**
 * Returns the user's bucket by it's ID
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.getBucketById = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;

  log.info('looking up bucket %s for %s', req.params.id, req.user._id);

  Bucket.findOne({
    _id: req.params.id,
    user: req.user._id
  }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    res.status(200).send(bucket.toObject());
  });
};

/**
 * Creates a new bucket for the user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.createBucket = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;
  const PublicKey = this.storage.models.PublicKey;

  if (!Array.isArray(req.body.pubkeys)) {
    req.body.pubkeys = [];
  }

  if (req.pubkey && req.body.pubkeys.indexOf(req.pubkey._id) === -1) {
    req.body.pubkeys.push(req.pubkey._id);
  }

  log.info('creating bucket for %s', req.user._id);

  try {
    for (let k = 0; k < req.body.pubkeys.length; k++) {
      PublicKey.validate(req.body.pubkeys[k]);
    }
  } catch (err) {
    return next(new errors.BadRequestError('Invalid public key supplied'));
  }

  Bucket.create(req.user, req.body, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.status(200).send(bucket.toObject());
  });
};

/**
 * Destroys the user's bucket by ID
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.destroyBucketById = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;

  log.info('removing bucket %s for %s', req.params.id, req.user._id);

  Bucket.findOne({
    _id: req.params.id,
    user: req.user._id
  }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    bucket.remove(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      BucketEntry.remove({ bucket: req.params.id }); // NB: Fire and forget
      res.status(204).end();
    });
  });
};

/**
 * Updates the given bucket's properties
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.updateBucketById = function(req, res, next) {
  const PublicKey = this.storage.models.PublicKey;
  const Bucket = this.storage.models.Bucket;

  log.info('updating bucket %s for %s', req.params.id, req.user._id);

  Bucket.findOne({
    _id: req.params.id,
    user: req.user._id
  }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    var allowed = ['storage', 'transfer', 'name', 'pubkeys'];

    for (let prop in req.body) {
      if (allowed.indexOf(prop) !== -1) {
        bucket[prop] = req.body[prop];
      }
    }

    try {
      for (let k = 0; k < bucket.pubkeys.length; k++) {
        PublicKey.validate(bucket.pubkeys[k]);
      }
    } catch (err) {
      return next(new errors.BadRequestError('Invalid public key supplied'));
    }

    bucket.save(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      res.status(200).send(bucket.toObject());
    });
  });
};

/**
 * Creates a bucket operation token
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.createBucketToken = function(req, res, next) {
  const self = this;
  const Bucket = this.storage.models.Bucket;
  const Token = this.storage.models.Token;

  // NB: We've got some authentication logic happening here to support the
  // NB: use of unregistered public keys for token creation. Let's take care
  // NB: to review and possibly refactor this into a more intelligent
  // NB: middleware later.
  // NB: Also, be aware that `req.body` does not yet exist until after the
  // NB: `rawbody` middleware has been called.

  function authorize(callback) {
    let query = { _id: req.params.id };
    let strategy = authenticate._detectStrategy(req);
    let rawbody = self._verify[0];
    let checkauth = self._verify[1];

    rawbody(req, res, function(err) {
      if (err) {
        return callback(err);
      }

      checkauth(req, res, function(err) {
        if (err) {
          if (strategy === 'ECDSA' && authenticate._verifySignature(req)) {
            query.pubkeys = { $in: [req.header('x-pubkey')] };
            return callback(null, query);
          } else {
            return callback(err);
          }
        }

        query.user = req.user._id;
        return callback(null, query);
      });
    });
  }

  authorize(function(err, query) {
    if (err) {
      return next(err);
    }

    log.info('creating %s token for %s', req.body.operation, req.params.id);

    Bucket.findOne(query, function(err, bucket) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      let operation = req.body.operation;

      Token.create(bucket, operation, function(err, token) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(200).send(token.toObject());
      });
    });
  });
};

/**
 * Creates a bucket entry from the given frame object
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.createEntryFromFrame = function(req, res, next) {
  const Frame = this.storage.models.Frame;
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;

  Bucket.findOne({
    user: req.user._id,
    _id: req.params.id
  }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    Frame.findOne({
      _id: req.body.frame,
      user: req.user._id
    }, function(err, frame) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!frame) {
        return next(new errors.NotFoundError('Frame not found'));
      }

      let entry = new BucketEntry({
        bucket: bucket._id,
        frame: frame._id,
        mimetype: req.body.mimetype,
        name: req.body.filename
      });

      entry.save(function(err) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.send(merge(entry.toObject()), { size: frame.size });
      });
    });
  });
};

/**
 * Negotiates retrieval tokens from the farmers storing the shards
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.getFile = function(req, res, next) {
  const self = this;
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;
  const Contact = this.storage.models.Contact;

  function getRetrievalToken(shard, callback) {
    self.network._manager.load(shard.hash, function(err, item) {
      if (err) {
        return callback(err);
      }

      let farmers = Object.keys(item.contracts);
      let token = null;

      function test() {
        return typeof token === 'string' || farmers.length === 0;
      }

      async.until(test, function(done) {
        Contact.findOne({ _id: farmers.shift() }, function(err, contact) {
          if (err) {
            return done(err);
          }

          let farmer = new storj.Contact(contact);
          let contract = item.contracts[farmer.nodeID];

          self.network.getRetrievalToken(farmer, contract, function(err, res) {
            if (err) {
              return done();
            }

            token = res;

            if (!token) {
              return done(new Error(
                'Failed to get a retrieval token from farmers'
              ));
            }

            done(null, {
              token: token,
              hash: item.hash,
              farmer: 'ws://' + farmer.address + ':' + farmer.port
            });
          });
        });
      }, callback);
    });
  }

  Bucket.findOne({
    user: req.user._id,
    _id: req.params.id
  }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    BucketEntry.findOne({
      _id: req.params.file,
      bucket: bucket._id
    }).populate('frame').exec(function(err, entry) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!entry) {
        return next(new errors.NotFoundError('File not found'));
      }

      async.map(entry.frame.shards.sort(function(a, b) {
        return a.index - b.index;
      }), getRetrievalToken, function(err, results) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.send(results);
      });
    });
  });
};

/**
 * Lists the file pointers stored in the given bucket
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.listFilesInBucket = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;

  log.info('looking up files stored in bucket %s', req.params.id);

  Bucket.findOne({
    _id: req.params.id,
    user: req.user._id
  }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    BucketEntry.find({
      bucket: req.params.id
    }).populate('frame').exec(function(err, entries) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      res.status(200).send(entries.map(function(entry) {
        return {
          bucket: entry.bucket,
          mimetype: entry.mimetype,
          filename: entry.filename,
          size: entry.frame.size,
          id: entry._id
        };
      }));
    });
  });
};

/**
 * Removes the file pointer from the bucket
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.removeFile = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;

  Bucket.findOne({
   _id: req.params.id,
   user: req.user._id
  }, function(err, bucket) {
   if (err) {
     return next(new errors.InternalError(err.message));
   }

   if (!bucket) {
     return next(new errors.NotFoundError('Bucket not found'));
   }

   BucketEntry.findOne({
     bucket: bucket._id,
     _id: req.params.file
   }, function(err, entry) {
     if (err) {
       return next(err);
     }

     if (!entry) {
       return next(new errors.NotFoundError('File not found'));
     }

     entry.remove(function(err) {
       if (err) {
         return next(new errors.InternalError(err.message));
       }

       res.status(204).end();
     });
   });
  });
};

/**
 * Export definitions
 * @private
 */
BucketsRouter.prototype._definitions = function() {
  return [
    ['GET', '/buckets', this._verify, this.getBuckets],
    ['GET', '/buckets/:id', this._verify, this.getBucketById],
    ['POST', '/buckets', this._verify, this.createBucket],
    ['DELETE', '/buckets/:id', this._verify, this.destroyBucketById],
    ['PATCH', '/buckets/:id', this._verify, this.updateBucketById],
    ['POST', '/buckets/:id/tokens', this.createBucketToken],
    ['GET', '/buckets/:id/files', this._verify, this.listFilesInBucket],
    ['GET', '/buckets/:id/files/:file', this._usetoken, this.getFile],
    ['DELETE', '/buckets/:id/files/:file', this._verify, this.removeFile],
    ['POST', '/buckets/:id/files', this._verify , this.createEntryFromFrame]
  ];
};

module.exports = BucketsRouter;
