'use strict';

const async = require('async');
const storj = require('storj-lib');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const tokenauth = middleware.tokenauth;
const publicBucket = middleware.publicBucket;
const log = require('../../logger');
const merge = require('merge');
const errors = require('storj-service-error-types');
const Router = require('./index');
const inherits = require('util').inherits;
const ms = require('ms');

/**
 * Handles endpoints for all bucket and file related operations
 * @constructor
 * @extends {Router}
 */
function BucketsRouter(options) {
  if (!(this instanceof BucketsRouter)) {
    return new BucketsRouter(options);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
  this._isPublic = publicBucket(this.storage);
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

    res.status(201).send(bucket.toObject());
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

    var allowed = ['pubkeys', 'encryptionKey', 'publicPermissions'];

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
    let isPublic = self._isPublic;

    rawbody(req, res, function(err) {
      if (err) {
        return callback(err);
      }

      isPublic(req, res, function(err){
        if(!err){
          return callback(null, query);
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

        var tokenObject = token.toObject();
        tokenObject.encryptionKey = bucket.encryptionKey;

        res.status(201).send(tokenObject);
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

      if (frame.locked) {
        return next(new errors.BadRequestError('Frame is already locked'));
      }

      BucketEntry.create({
        bucket: bucket._id,
        frame: frame._id,
        mimetype: req.body.mimetype,
        name: req.body.filename
      }, function(err, entry) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        frame.lock(function(err) {
          if (err) {
            return next(new errors.InternalError(err));
          }

          res.send(merge(entry.toObject(), { size: frame.size }));
        });
      });
    });
  });
};

/**
 * Replicates the pointers in the given frame to mirror nodes
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.replicateFile = function(req, res, callback) {
  const self = this;
  const network = this.network;
  const contracts = this.contracts;
  const Pointer = this.storage.models.Pointer;
  const Contact = this.storage.models.Contact;
  const BucketEntry = this.storage.models.BucketEntry;
  const Bucket = this.storage.models.Bucket;
  const Mirror = this.storage.models.Mirror;

  if (!req.body.file) {
    return callback(new errors.BadRequestError('No file ID supplied'));
  }

  if (req.body.redundancy > 12) {
    return callback(
      new errors.BadRequestError('Refusing to create more than 12 mirrors')
    );
  }

  function _getBucket(next) {
    log.info('getting bucket for file mirroring %s', req.params.id);
    Bucket.findOne({
      _id: req.params.id,
      user: req.user._id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      next(null, bucket);
    });
  }

  function _getBucketEntry(bucket, next) {
    log.info('getting bucket entry for file mirroring %s', req.body.file);
    BucketEntry.findOne({
      _id: req.body.file,
      bucket: bucket._id
    }).populate('frame').exec(function(err, bucketEntry) {
      if (err) {
        return next(err);
      }

      if (!bucketEntry) {
        return next(new errors.NotFoundError('Bucket entry not found'));
      }

      next(null, bucketEntry);
    });
  }

  function _getShardHashesFromFrame(bucketEntry, next) {
    log.info('getting shard hashes from the bucket entry frame');
    Pointer.find({
      _id: { $in: bucketEntry.frame.shards }
    }, function(err, pointers) {
      if (err) {
        return next(err);
      }

      next(null, pointers.map(function(pointer) {
        return pointer.hash;
      }));
    });
  }

  function _getQueuedMirrorsFromHashes(hashes, next) {
    log.info('getting queued mirror contacts for shard hashes');
    async.map(hashes, function(hash, done) {
      Mirror.find({
        shardHash: hash,
        isEstablished: false
      }, function(err, mirrors) {
        if (err) {
          return done(err);
        }

        done(null, mirrors);
      });
    }, next);
  }

  function _getRetrievalPointersFromFarmers(mirrors, next) {
    log.info('mapping mirror contacts for hashes');
    async.mapSeries(mirrors, function(mirrorList, done) {
      async.map(mirrorList, function(mirror, done) {
        contracts.load(mirror.shardHash, function(err, item) {
          if (err) {
            return done(err);
          }

          var farmerIds = Object.keys(item.contracts);
          var farmerIdIndex = Math.floor(Math.random() * farmerIds.length);
          var farmerTarget = farmerIds[farmerIdIndex];
          var farmerContract = item.contracts[farmerTarget];

          Contact.findOne({ _id: farmerTarget }, function(err, contact) {
            if (err) {
              return done(err);
            }

            if (!contact) {
              return done(new errors.NotFoundError('Contact not found'));
            }

            network.getRetrievalPointer(
              storj.Contact(contact.toObject()),
              farmerContract,
              function(err, dataChannelPointer) {
                if (err) {
                  return done(err);
                }

                done(null, {
                  mirror: mirror,
                  source: dataChannelPointer,
                  destination: storj.Contact(contact.toObject())
                });
              }
            );
          });
        });
      }, done);
    }, next);
  }

  function _establishMirrors(mirrorMap, next) {
    log.info('establishing mirrors on the network');
    async.mapSeries(mirrorMap, function(mirrorList, done) {
      var sources = [];
      var destinations = [];

      if (!mirrorList.length) {
        return done(null, []);
      }

      var hash = mirrorList[0].mirror.shardHash;

      contracts.load(hash, function(err, item) {
        if (err) {
          return done(err);
        }

        mirrorList.forEach(function(mirrorData) {
          sources.push(mirrorData.source);
          destinations.push(mirrorData.destination);
          item.addContract(
            mirrorData.destination,
            storj.Contract.fromObject(mirrorData.mirror.contract)
          );

          mirrorData.mirror.isEstablished = true;
          mirrorData.mirror.save();
        });

        contracts.save(item, function(err) {
          if (err) {
            return done(err);
          }

          network.getMirrorNodes(sources, destinations, done);
        });
      });
    }, next);
  }

  async.waterfall(
    [
      _getBucket,
      _getBucketEntry,
      _getShardHashesFromFrame,
      _getQueuedMirrorsFromHashes,
      _getRetrievalPointersFromFarmers,
      _establishMirrors
    ],
    function(err, mirrors) {
      if (err) {
        return callback(err);
      }

      // TODO: Iterate through mirrors and update their document status


      res.send(mirrors);
    }
  );
};

/**
 * Negotiates retrieval tokens from the farmers storing the shards
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.getFile = function(req, res, next) {
  const self = this;
  const contracts = this.contracts;
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;
  const Contact = this.storage.models.Contact;
  const Pointer = this.storage.models.Pointer;

  function getRetrievalToken(shard, callback) {
    log.debug('getting retrieval token for %j', shard);
    contracts.load(shard.hash, function(err, item) {
      if (err) {
        return callback(err);
      }

      let farmers = Object.keys(item.contracts).filter(function(nodeID) {
        return (
          req.query.exclude ? req.query.exclude.split(',') : []
        ).indexOf(nodeID) === -1;
      });
      let token = null;

      function test() {
        return typeof token === 'string' || farmers.length === 0;
      }

      function handleResults(err, pointer) {
        if (!token) {
          return callback(new Error('Failed to get retrieval token'));
        }

        callback(null, pointer);
      }

      async.until(test, function(done) {
        Contact.findOne({ _id: farmers.shift() }, function(err, contact) {
          if (err) {
            log.error(err.message);
            return done();
          }

          if (!contact) {
            log.error('Failed to find farmer contact');
            return done();
          }

          let farmer = new storj.Contact(contact);
          let contract = item.contracts[farmer.nodeID];

          self.network.getRetrievalPointer(farmer, contract, function(err, dcPointer) {
            if (err) {
              log.error(err.message);
              return done();
            }

            token = dcPointer.token;

            if (!token) {
              log.error('Failed to get a retrieval token from farmer');
              return done();
            }

            if (!item.meta[farmer.nodeID]) {
              item.addMetaData(farmer, { downloadCount: 0 });
            }

            if (!item.meta[farmer.nodeID].downloadCount) {
              item.meta[farmer.nodeID].downloadCount = 0;
            }

            item.meta[farmer.nodeID].downloadCount++;

            self.contracts.save(item, function(err) {
              if (err) {
                log.error('Failed to update download count: %s', err.message);
              }

              done(null, {
                token: token,
                hash: item.hash,
                farmer: farmer,
                operation: 'PULL',
                size: shard.size
              });
            });
          });
        });
      }, handleResults);
    });
  }

  if (req.params.id !== req.token.bucket.toString()) {
    return next(new errors.NotAuthorizedError());
  }

  Bucket.findOne({
    _id: req.token.bucket
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

      let pQuery = { _id: { $in: entry.frame.shards } };
      let pSkip = Number(req.query.skip) || 0;
      let pLimit = Number(req.query.limit) || 6;
      let pSort = { index: 1 };
      let cursor = Pointer.find(pQuery).skip(pSkip).limit(pLimit).sort(pSort);

      cursor.exec(function(err, pointers) {
        if (err) {
          return next(new errors.InternalError(err));
        }

        async.mapSeries(pointers, getRetrievalToken, function(err, results) {
          if (err) {
            return next(new errors.InternalError(err.message));
          }

          res.send(results);
        });
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
          frame: entry.frame.id,
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

BucketsRouter.prototype.getFileInfo = function(req, res, next) {
  const BucketEntry = this.storage.models.BucketEntry;

  BucketEntry.findOne({
    bucket: req.params.id,
    _id: req.params.file
  }).populate('frame').exec(function(err, entry) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.status(200).send({
      bucket: entry.bucket,
      mimetype: entry.mimetype,
      filename: entry.filename,
      frame: entry.frame.id,
      size: entry.frame.size,
      id: entry._id
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
    ['GET', '/buckets/:id/files/:file/info', this._verify, this.getFileInfo],
    ['POST', '/buckets/:id/files', this._verify , this.createEntryFromFrame],
    ['POST', '/buckets/:id/mirrors', this._verify, this.replicateFile]
  ];
};

module.exports = BucketsRouter;
