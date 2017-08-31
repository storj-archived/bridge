'use strict';

const ms = require('ms');
const assert = require('assert');
const async = require('async');
const storj = require('storj-lib');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const tokenauth = middleware.tokenauth;
const publicBucket = middleware.publicBucket;
const log = require('../../logger');
const merge = require('merge');
const mongoose = require('mongoose');
const errors = require('storj-service-error-types');
const Router = require('./index');
const inherits = require('util').inherits;
const utils = require('../../utils');
const constants = require('../../constants');
const analytics = require('storj-analytics');
const limiter = require('../limiter').DEFAULTS;

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
  this.getLimiter = middleware.rateLimiter(options.redis);
}

inherits(BucketsRouter, Router);

BucketsRouter.prototype._usetokenOrVerify = function(req, res, next) {
  if (req.headers['x-token']) {
    this._usetoken(req, res, next);
  } else {
    // NB: Authenticate middleware is array of rawbody and authenticate
    assert(this._verify.length === 2);
    const rawbody = this._verify[0];
    const authenticate = this._verify[1];
    rawbody(req, res, (err) => {
      if (err) {
        return next(err);
      }
      authenticate(req, res, next);
    });
  }
};

BucketsRouter.prototype._validate = function(req, res, next) {
  if (req.params.id && !utils.isValidObjectId(req.params.id)) {
    return next(new errors.BadRequestError('Bucket id is malformed'));
  }
  if (req.params.file && !utils.isValidObjectId(req.params.file)) {
    return next(new errors.BadRequestError('File id is malformed'));
  }
  next();
};

/**
 * Returns a list of buckets for the user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.getBuckets = function(req, res, next) {

  let findQuery = { user: req.user._id };
  const startDate = utils.parseTimestamp(req.query.startDate);
  if (startDate) {
    findQuery.created = { $gt: startDate };
  }

  this.storage.models.Bucket
    .find(findQuery)
    .limit(constants.DEFAULT_MAX_BUCKETS)
    .exec(function(err, buckets) {
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

BucketsRouter.prototype.getBucketId = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;

  Bucket.findOne({
    user: req.user._id,
    name: req.params.name
  }, '_id', { lean: true }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    res.status(200).send({ id: bucket._id });
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

  if (req.body.name && req.body.name.length > constants.MAX_BUCKETNAME) {
    return next(new errors.BadRequestError('Maximum bucket name'));
  }

  if (!Array.isArray(req.body.pubkeys)) {
    req.body.pubkeys = [];
  }

  if (req.pubkey && req.body.pubkeys.indexOf(req.pubkey._id) === -1) {
    req.body.pubkeys.push(req.pubkey._id);
  }

  try {
    for (let k = 0; k < req.body.pubkeys.length; k++) {
      PublicKey.validate(req.body.pubkeys[k]);
    }
  } catch (err) {
    return next(new errors.BadRequestError('Invalid public key supplied'));
  }

  analytics.track(req.headers.dnt, {
    userId: req.user.uuid,
    event: 'Bucket Created'
  });

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
  const StorageEvent = this.storage.models.StorageEvent;

  const bucketObjectId = new mongoose.Types.ObjectId(req.params.id);

  analytics.track(req.headers.dnt, {
    userId: req.user.uuid,
    event: 'Bucket Destroyed'
  });

  BucketEntry.aggregate([
      {
        $match: {
          bucket: bucketObjectId
        }
      },
      {
        $lookup: {
          from: 'frames',
          localField: 'frame',
          foreignField: '_id',
          as: 'frameData'
        }
      },
      {
        $unwind: {
          path: '$frameData'
        }
      },
      {
        $project: {
          _id: 0,
          bucket: '$bucket',
          bucketEntry: '$_id',
          user: {$literal: req.user._id},
          downloadBandwidth: {$literal: 0},
          storage: {$multiply: [-1, '$frameData.size']},
          timestamp: {$add: [new Date(), 0]}
        }
      }],
    function(err, storageEvents) {
      if (err) {
        log.warn('destroyBucketById: storage event aggregation failed, reason: %s',
          err.message);
      }

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
          BucketEntry.remove({ bucket: req.params.id }, (err) => {
            if (err) {
              log.error('Unable to remove bucket entries, reason: %s',
                err.message);
            }
            StorageEvent.collection.insert(storageEvents, function(err) {
              if (err) {
                log.warn('Unable to save storage events, reason: %s',
                  err.message);
              }
          });
        });
        });
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
 * Loads the bucket for an authorized but unregistered user
 * @private
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype._getBucketUnregistered = function(req, res, next) {
  const self = this;
  const Bucket = this.storage.models.Bucket;

  let query = { _id: req.params.id };
  let strategy = authenticate._detectStrategy(req);
  let rawBody = self._verify[0];
  let checkAuth = self._verify[1];
  let isPublicBucket = self._isPublic;

  function _checkAuthIfNotPublic(req, res, next) {
    isPublicBucket(req, res, function(err) {
      if (err) {
        return checkAuth(req, res, next);
      }

      next(null);
    });
  }

  async.series([
    rawBody.bind(null, req, res),
    _checkAuthIfNotPublic.bind(null, req, res)
  ], function(err) {
    if (err) {
      if (strategy === 'ECDSA' && authenticate._verifySignature(req)) {
        query.pubkeys = { $in: [req.header('x-pubkey')] };
      } else {
        return next(err);
      }
    }

    if (req.user) {
      query.user = req.user._id;
    }

    Bucket.findOne(query, function(err, bucket) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      next(null, bucket);
    });
  });
};
/**
 * @callback BucketsRouter~_getBucketUnregisteredCallback
 * @param {Error|null} [error]
 * @param {Bucket} bucket
 */

/**
 * Creates a bucket operation token
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.createBucketToken = function(req, res, next) {
  const Token = this.storage.models.Token;
  const BucketEntry = this.storage.models.BucketEntry;
  const Bucket = this.storage.models.Bucket;

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

    analytics.track(req.headers.dnt, {
      userId: req.user.uuid,
      event: 'Token Created',
      properties: {
        type: req.body.operation
      }
    });

    Token.create(bucket, req.body.operation, function(err, token) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      var tokenObject = token.toObject();
      tokenObject.encryptionKey = bucket.encryptionKey;

      var file = req.body.file;
      if (!file || req.body.operation !== 'PULL') {
        res.status(201).send(tokenObject);
        return;
      }

      BucketEntry.findOne({
        _id: file,
        bucket: bucket._id
      }).populate('frame').exec(function(err, bucketEntry) {
        if (err) {
          return next(err);
        }
        if (!bucketEntry) {
          return next(new errors.NotFoundError('Bucket entry not found'));
        }
        tokenObject.mimetype = bucketEntry.mimetype;
        tokenObject.size = bucketEntry.frame.size;
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
  const StorageEvent = this.storage.models.StorageEvent;

  if (req.body.filename &&
      req.body.filename.length > constants.MAX_BUCKETENTRYNAME) {
    return next(new errors.BadRequestError('Maximum bucket entry name'));
  }

  analytics.track(req.headers.dnt, {
    userId: req.user.uuid,
    event: 'File Upload Complete'
  });

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
        name: req.body.filename,
        hmac: req.body.hmac,
        erasure: req.body.erasure,
        index: req.body.index
      }, function(err, entry) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        frame.lock(function(err) {
          if (err) {
            return next(new errors.InternalError(err.message));
          }

          var fileCreationStorageEventData = {
            bucket: req.params.id,
            bucketEntry: entry._id,
            user: req.user._id,
            downloadBandwidth: 0,
            storage: frame.storageSize
          };

          var fileCreationStorageEvent = new StorageEvent(fileCreationStorageEventData);

          fileCreationStorageEvent.save(function(err) {
            if (err) {
              log.warn('createEntryFromFrame: failed to save storage event, reason: %s',
                err.message);
            }
          });

          res.send(merge(entry.toObject(), { size: frame.size }));
        });
      });
    });
  });
};

/**
 * Returns the bucket by ID
 * @param {String|ObjectId} bucketId - The unique _id for the bucket
 * @param {String} [userId] - The email address for the user
 * @param {BucketsRouter~_getBucketByIdCallback}
 */
BucketsRouter.prototype._getBucketById = function(bucketId, userId, callback) {
  var query = { _id: bucketId };

  if (typeof userId === 'function') {
    callback = userId;
    userId = null;
  }

  if (userId) {
    query.user = userId;
  }

  this.storage.models.Bucket.findOne(query, function(err, bucket) {
    if (err) {
      return callback(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return callback(new errors.NotFoundError('Bucket not found'));
    }

    callback(null, bucket);
  });
};
/**
 * @callback BucketsRouter~_getBucketByIdCallback
 * @param {Error|null} error
 * @param {Bucket} bucket
 */

/**
 * Returns the bucket entry by ID
 * @param {String|ObjectId} bucketId - The unique _id for the bucket
 * @param {String} bucketEntryId - The unique _id for the bucket entry
 * @param {BucketsRouter~_getBucketEntryByIdCallback}
 */
BucketsRouter.prototype.getBucketEntryById = function(bucketId, entryId, done) {
  this.storage.models.BucketEntry.findOne({
    _id: entryId,
    bucket: bucketId
  }).populate('frame').exec(function(err, entry) {
    if (err) {
      return done(new errors.InternalError(err.message));
    }

    if (!entry) {
      return done(new errors.NotFoundError('Entry not found'));
    }

    done(null, entry);
  });
};
/**
 * @callback BucketsRouter~_getBucketEntryByIdCallback
 * @param {Error|null} error
 * @param {BucketEntry} bucketEntry
 */

/**
 * Returns the pointers for a given bucket entry
 * @param {BucketEntry} bucketEntry
 * @param {BucketsRouter~getPointersForEntryCallback}
 */
BucketsRouter.prototype.getPointersForEntry = function(bucketEntry, next) {
  this.storage.models.Pointer.find({
    _id: { $in: bucketEntry.frame.shards }
  }, function(err, pointers) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    next(null, pointers);
  });
};
/**
 * @callback BucketsRouter~getPointersForEntryCallback
 * @param {Error|null} error
 * @param {Pointers[]} shardPointers
 */

/**
 * Returns possible mirroring candidates for a group of pointers
 * @param {Pointer} shardPointer
 * @param {BucketsRouter~getMirrorsForPointersCallback}
 */
BucketsRouter.prototype.getMirrorsForPointers = function(pointers, callback) {
  var self = this;
  var hashes = pointers.map(function(pointer) {
    return pointer.hash;
  });

  async.map(hashes, function(hash, done) {
    self.storage.models.Mirror.find(
      { shardHash: hash, isEstablished: false },
      done
    );
  }, callback);
};
/**
 * @callback BucketsRouter~getMirrorsForPointersCallback
 * @param {Error|null} error
 * @param {Array.<Array.<Mirror>>} mirrors
 */

/**
 * Retreives a contact by it's Node ID
 * @param {String} nodeId - Farmers public key hash
 * @param {BucketsRouter~getContactByIdCallback}
 */
BucketsRouter.prototype.getContactById = function(nodeId, callback) {
  this.storage.models.Contact.findOne({ _id: nodeId }, function(err, contact) {
    if (err) {
      return callback(new errors.InternalError(err.message));
    }

    if (!contact) {
      return callback(new errors.NotFoundError('Contact not found'));
    }

    callback(null, contact);
  });
};
/**
 * @callback BucketsRouter~getContactByIdCallback
 * @param {Error|null} error
 * @param {Contact} contact
 */

/**
 * Authorizes a mirror node to retreive data from a source
 * @param {Mirror} mirror - The mirror object
 * @param {BucketsRouter~getMirrorAuthorizationCallback}
 */
BucketsRouter.prototype.getMirrorAuthorization = function(mirror, done) {
  var self = this;
  var contracts = this.contracts;
  var network = this.network;

  contracts.load(mirror.shardHash, function(err, item) {
    if (err) {
      return done(err);
    }

    var sourceIds = Object.keys(item.contracts);
    var sourceIdIndex = Math.floor(Math.random() * sourceIds.length);
    var sourceId = sourceIds[sourceIdIndex];
    var sourceContract = item.contracts[sourceId];

    async.parallel([
      self.getContactById.bind(self, sourceId),
      self.getContactById.bind(self, mirror.contact)
    ], function(err, contacts) {
      if (err) {
        return done(err);
      }

      var [source, destination] = contacts.map((c) => new storj.Contact(c));

      network.getRetrievalPointer(source, sourceContract, function(err, dcp) {
        if (err) {
          return done(err);
        }

        done(null, {
          mirror: mirror,
          source: dcp,
          destination: destination
        });
      });
    });
  });
};
/**
 * @callback BucketsRouter~getMirrorAuthorizationCallback
 * @param {Error|null} error
 * @param {Object} mirrorAuth
 * @param {Mirror} mirrorAuth.mirror
 * @param {DataChannelPointer} mirrorAuth.source
 * @param {Contact} mirrorAuth.destination
 */

/**
 * Creates a mirror authorization pointer map
 * @param {Array.<Array.<Mirror>>} mirrorMap
 * @param {BucketsRouter~getMirroringTokensCallback}
 */
BucketsRouter.prototype.getMirroringTokens = function(mirrorMap, next) {
  var self = this;

  async.mapSeries(mirrorMap, function(mirrorList, done) {
    async.map(mirrorList, self.getMirrorAuthorization.bind(self), done);
  }, next);
};
/**
 * @callback BucketsRouter~getMirroringTokensCallback
 * @param {Error|null} error
 * @param {Array[].<Object>}  tokenMap
 * @param {Mirror} tokenMap.mirror
 * @param {DataChannelPointer} tokenMap.source
 * @param {Contact} tokenMap.destination
 */

/**
 * Establishes mirrors for a given token map
 * @param {Array[].<Object>}  tokenMap
 * @param {BucketsRouter~createMirrorsFromTokenMapCallback}
 */
BucketsRouter.prototype.createMirrorsFromTokenMap = function(tokenMap, next) {
  var self = this;

  async.mapSeries(tokenMap, function(tokenList, done) {
    if (!tokenList.length) {
      return done(null, []);
    }

    var sources = [], destinations = [];
    var hash = tokenList[0].mirror.shardHash;

    self.contracts.load(hash, function(err, item) {
      if (err) {
        return done(err);
      }

      async.each(tokenList, function(mirrorData, next) {
        sources.push(mirrorData.source);
        destinations.push(mirrorData.destination);
        item.addContract(
          mirrorData.destination,
          storj.Contract.fromObject(mirrorData.mirror.contract)
        );

        mirrorData.mirror.isEstablished = true;
        mirrorData.mirror.save(next);
      }, function(err) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        self.contracts.save(item, function(err) {
          if (err) {
            return done(err);
          }

          self.network.getMirrorNodes(sources, destinations, done);
        });
      });
    });
  }, next);
};
/**
 * @callback BucketsRouter~createMirrorsFromTokenMapCallback
 * @param {Error|null} error
 * @param {Array.<Array.<Contact>>} mirroredNodes
 */

/**
 * Lists all the established mirrors for a file
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
BucketsRouter.prototype.listMirrorsForFile = function(req, res, next) {
  const self = this;

  function _getFrameForFile(fileId, bucket, callback) {
    self.storage.models.BucketEntry.findOne({
      bucket: bucket.id,
      _id: fileId
    }).populate('frame').exec(function(err, bucketEntry) {
      if (err) {
        return next(err);
      }

      if (!bucketEntry) {
        return next(new errors.NotFoundError('File not found'));
      }

      callback(null, bucketEntry.frame);
    });
  }

  function _getHashesFromFrame(frame, callback) {
    self.storage.models.Pointer.find({
      _id: { $in: frame.shards }
    }, function(err, pointers) {
      if (err) {
        return next(err);
      }

      callback(null, pointers.map((p) => p.hash));
    });
  }

  function _getMirrorsFromHashes(hashes, callback) {
    async.map(hashes, function(hash, next) {
      self.storage.models.Shard.findOne({
        hash: hash
      }).exec((err, shard) => {
        if (err) {
          return next(err);
        }

        let result = { established: [], available: [] };
        let { established } = result;

        if (!shard) {
          return next(null, result);
        }

        // NOTE: Available is no longer used here as available
        // mirrors are stored in TTL collection. The contact field
        // will also not be populated, the farmer_id will be included
        // if there are additional details needed.

        for (let i = 0; i < shard.contracts.length; i++) {
          let contract = shard.contracts[i].contract;
          established.push({
            shardHash: shard.hash,
            contract: {
              farmer_id: contract.farmer_id,
              data_size: contract.data_size,
              store_begin: contract.store_begin,
              store_end: contract.store_end
            }
          });
        }

        next(null, result);
      });
    }, callback);
  }

  async.waterfall([
    this._getBucketById.bind(this, req.params.id, req.user._id),
    _getFrameForFile.bind(this, req.params.file),
    _getHashesFromFrame,
    _getMirrorsFromHashes
  ], (err, result) => {
    if (err) {
      return next(err);
    }

    res.status(200).send(result);
  });
};

/**
 * Fetches a RETRIEVE token from a farmer for the given shard
 * @private
 * @param {Pointer} shardPointer - Pointer document to retrieve
 * @param {Object} options
 * @param {Array} options.excludeFarmers - Blacklist array of Node IDs
 * @param {BucketsRouter~_getRetrievalTokenCallback}
 */
BucketsRouter.prototype._getRetrievalToken = function(sPointer, opts, done) {
  const self = this;

  log.debug('getting retrieval token for %j', sPointer);
  this.contracts.load(sPointer.hash, function(err, item) {
    if (err) {
      return done(err);
    }

    let farmers = Object.keys(item.contracts).filter(function(nodeID) {
      return opts.excludeFarmers.indexOf(nodeID) === -1;
    });

    self.storage.models.Contact.find({
      _id: { $in: farmers }
    }, (err, contacts) => {
      if (err) {
        return done(err);
      }

      let currentTime = Date.now();
      let finalHandlerAlreadyCalled = false;
      let {farmerTimeoutIgnore} = self.config.application;
      let farmerTimeoutMs = ms(farmerTimeoutIgnore || '10m');
      let options = contacts
        .filter((c) => {
          if (!c.lastTimeout || c.lastSeen > c.lastTimeout) {
            return true;
          }

          return currentTime - c.lastTimeout > farmerTimeoutMs;
        })
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .map((c) => ({ contact: storj.Contact(c), pointer: null }));

      let retrievalTimeout = setTimeout(() => {
        handleResults(
          new errors.ServiceUnavailableError('Timed out waiting for pointers')
        );
        finalHandlerAlreadyCalled = true;
      }, 20000);

      function handleResults(err, result) {
        if (finalHandlerAlreadyCalled) {
          return;
        }

        finalHandlerAlreadyCalled = true;
        clearTimeout(retrievalTimeout);

        let data = {
          index: sPointer.index,
          hash: sPointer.hash,
          size: sPointer.size,
          parity: sPointer.parity
        };

        // We want to return the result even if there was a failure
        // to retrieve the token from the farmer, it will just be missing
        // a token and farmer contact.
        if (err || !result) {
          log.warn(
            'Failed to get retrieval token, %s',
            err ? err.message : 'No farmers responded'
          );
        } else {
          data.token = result.pointer.token;
          data.farmer = result.pointer.farmer;
          data.operation = 'PULL';
        }
        done(null, data);
      }

      async.detectLimit(
        options,
        6,
        self._requestRetrievalPointer.bind(self, item),
        handleResults
      );
    });
  });
};
/**
 * @callback BucketsRouter~_getRetrievalTokenCallback
 * @param {Error|null} [error]
 * @param {Object} dataChannelPointer
 * @param {String} dataChannelPointer.token
 * @param {String} dataChannelPointer.hash
 * @param {Contact} dataChannelPointer.farmer
 * @param {String} dataChannelPointer.operation
 * @param {Number} dataChannelPointer.size
 */

/**
 * Requests a retrieval pointer from the first farmer in the given list
 * @private
 * @param {StorageItem} item - Loaded storage item data
 * @param {Object} opts
 * @param {Contact} opts.contact
 * @param {Pointer|null} opts.pointer
 * @param {BucketsRouter~_requestRetrievalPointerCallback}
 */
BucketsRouter.prototype._requestRetrievalPointer = function(item, meta, done) {
  const network = this.network;
  const contract = item.getContract(meta.contact);

  network.getRetrievalPointer(meta.contact, contract, function(err, dcPointer) {
    if (err) {
      log.error(err.message);
      return done(null, false);
    }

    if (!dcPointer.token) {
      log.error('Failed to get a retrieval token from farmer');
      return done();
    }

    meta.pointer = {
      token: dcPointer.token,
      farmer: meta.contact
    };

    done(null, true);
  });
};
/**
 * @callback BucketsRouter~_requestRetrievalPointerCallback
 * @param {Error|null} [error]
 * @param {Object} [dataChannelPointer]
 * @param {String} [dataChannelPointer.token]
 * @param {String} [dataChannelPointer.hash]
 * @param {Contact} [dataChannelPointer.farmer]
 * @param {String} [dataChannelPointer.operation]
 */

/**
 * Resolves shard pointer from a populated bucket entry
 * @private
 * @param {BucketEntry} entry - Populated bucket entry
 * @param {Object} options
 * @param {Number} options.skip - Skip returned entries
 * @param {Number} options.limit - Limit returned entries
 * @param {String[]} options.excludeFarmers - Blackisted NodeIDs
 * @param {BucketsRouter~_getPointersFromEntryCallback}
 */
BucketsRouter.prototype._getPointersFromEntry = function(entry, opts,
                                                         user, done) {
  const self = this;
  const StorageEvent = this.storage.models.StorageEvent;
  const Pointer = this.storage.models.Pointer;

  let pQuery = {
    _id: { $in: entry.frame.shards },
    index: {
      $gte: parseInt(opts.skip) || 0,
      $lt: parseInt(opts.skip) + parseInt(opts.limit) || 6
    }
  };
  let pSort = { index: 1 };
  let cursor = Pointer.find(pQuery).sort(pSort);

  cursor.exec(function(err, pointers) {
    if (err) {
      return done(new errors.InternalError(err.message));
    }

    const bytes = pointers.reduce((a, b) => {
      return { size: a.size + b.size };
    }, { size: 0 }).size;

    if (!Number.isFinite(bytes)) {
      log.warn('getPointersFromEntry: sum bytes %s is not a finite number ' +
               'for frame %s', bytes, entry.frame._id);
      return done(new errors.InternalError(
        'Pointer size in not a finite number'));
    }

    user.recordDownloadBytes(bytes, (err) => {
      if (err) {
        log.warn('getPointersFromEntry: unable to update downloaded bytes %s',
                 bytes);
      }
    });

    var fileDownloadStorageEventData = {
      bucket: entry.bucket,
      bucketEntry: entry._id,
      user: user._id,
      downloadBandwidth: bytes,
      storage: 0
    };

    var fileDownloadStorageEvent = new StorageEvent(fileDownloadStorageEventData);

    fileDownloadStorageEvent.save(function(err) {
      if (err) {
        log.warn('createEntryFromFrame: failed to save storage event, reason: %s',
                 err.message);
      }
    });

    async.mapLimit(pointers, 6, function(sPointer, next) {
      self._getRetrievalToken(sPointer, {
        excludeFarmers: opts.excludeFarmers
      }, next);
    }, function(err, results) {
      if (err) {
        return done(new errors.InternalError(err.message));
      }

      done(null, results);
    });
  });
};

/**
 * @callback BucketsRouter~_getPointersFromEntryCallback
 * @param {Error|null} [error]
 * @param {Object[]} pointers
 */

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
  const User = this.storage.models.User;

  const query = { _id: req.params.id };

  if (req.user) {
    query.user = req.user._id;
  } else {
    if (req.params.id !== req.token.bucket.toString()) {
      return next(new errors.NotAuthorizedError());
    }
  }

  Bucket.findOne(query, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    User.findOne({
      _id: bucket.user
    }, function(err, user) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!user) {
        return next(new errors.NotFoundError('User not found for bucket'));
      }

      const rates = self.config.application.freeTier.down;
      if (user.isDownloadRateLimited(rates.hourlyBytes,
                                     rates.dailyBytes,
                                     rates.monthlyBytes)) {

        log.warn('getFile: Transfer rate limited, user: %s', user.email);
        analytics.track(req.headers.dnt, {
          userId: user.uuid,
          event: 'User Download Rate Limited',
          properties: {
            monthlyBytes: user.bytesDownloaded.lastMonthBytes,
            dailyBytes: user.bytesDownloaded.lastDayBytes,
            hourlyBytes: user.bytesDownloaded.lastHourBytes
          }
        });
        return next(new errors.TransferRateError(
          'Could not get file, transfer rate limit reached.'
        ));
      }

      analytics.track(req.headers.dnt, {
        userId: user.uuid,
        event: 'File Pointers Retrieved'
      });

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

        self._getPointersFromEntry(entry, {
          skip: req.query.skip,
          limit: req.query.limit,
          excludeFarmers: req.query.exclude ? req.query.exclude.split(',') : []
        }, user, function(err, result) {
          if (err) {
            return next(err);
          }

          res.send(result);
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

    const startDate = utils.parseTimestamp(req.query.startDate);
    const findQuery = { bucket: req.params.id  };
    if (startDate) {
      findQuery.created = { $gt: startDate };
    }

    var query = BucketEntry
        .find(findQuery)
        .limit(constants.DEFAULT_MAX_ENTRIES)
        .populate('frame');
    var stream = query.cursor();

    stream.pipe(utils.createArrayFormatter(function(entry) {
      return {
        bucket: entry.bucket,
        mimetype: entry.mimetype,
        filename: entry.filename,
        frame: entry.frame.id,
        size: entry.frame.size,
        id: entry._id,
        created: entry.created,
        hmac: entry.hmac
      };
    })).pipe(res);
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
  const StorageEvent = this.storage.models.StorageEvent;

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
   }).populate('frame').exec(function(err, entry) {
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

       var fileRemovalEventData = {
         bucket: req.params.id,
         bucketEntry: req.params.file,
         user: req.user._id,
         downloadBandwidth: 0,
         storage: -1 * entry.frame.size
        };

       var fileRemovalStorageEvent = new StorageEvent(fileRemovalEventData);

       fileRemovalStorageEvent.save(function(err) {
         if (err) {
           log.warn('createEntryFromFrame: failed to save storage event, reason: %s',
                    err.message);
         }
       });

       res.status(204).end();
     });
   });
  });
};

BucketsRouter.prototype.getFileId = function(req, res, next) {
  const Bucket = this.storage.models.Bucket;
  const BucketEntry = this.storage.models.BucketEntry;

  Bucket.findOne({
    _id: req.params.id,
    user: req.user._id
  }, '_id', { lean: true }, function(err, bucket) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!bucket) {
      return next(new errors.NotFoundError('Bucket not found'));
    }

    BucketEntry.findOne({
      bucket: bucket._id,
      name: req.params.name
    }, '_id', { lean: true }, function(err, entry) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!entry) {
        return next(new errors.NotFoundError('File not found'));
      }
      res.status(200).send({ id: entry._id });
    });
  });

};


BucketsRouter.prototype.getFileInfo = function(req, res, next) {
  const BucketEntry = this.storage.models.BucketEntry;

  this._getBucketUnregistered(req, res, function(err, bucket) {
    if (err) {
      return next(err);
    }

    BucketEntry.findOne({
      bucket: bucket._id,
      _id: req.params.file
    }).populate('frame').exec(function(err, entry) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!entry) {
        return next(new errors.NotFoundError('File not found'));
      }

      res.status(200).send({
        bucket: entry.bucket,
        mimetype: entry.mimetype,
        filename: entry.filename,
        frame: entry.frame.id,
        size: entry.frame.size,
        id: entry._id,
        created: entry.created,
        hmac: entry.hmac,
        erasure: entry.erasure,
        index: entry.index
      });
    });
  });
};

/**
 * Export definitions
 * @private
 */
BucketsRouter.prototype._definitions = function() {
  /* jshint maxlen: 140 */
  return [
    ['GET', '/buckets', this.getLimiter(limiter(1000)), this._verify, this.getBuckets],
    ['GET', '/buckets/:id', this.getLimiter(limiter(1000)), this._validate, this._verify, this.getBucketById],
    ['GET', '/bucket-ids/:name', this.getLimiter(limiter(1000)), this._validate, this._verify, this.getBucketId],
    ['POST', '/buckets', this.getLimiter(limiter(1000)), this._verify, this.createBucket],
    ['DELETE', '/buckets/:id', this.getLimiter(limiter(1000)), this._validate, this._verify, this.destroyBucketById],
    ['PATCH', '/buckets/:id', this.getLimiter(limiter(1000)), this._validate, this._verify, this.updateBucketById],
    ['POST', '/buckets/:id/tokens', this.getLimiter(limiter(1000)), this._validate, this._verify, this.createBucketToken],
    ['GET', '/buckets/:id/files', this.getLimiter(limiter(1000)), this._validate, this._verify, this.listFilesInBucket],
    ['GET', '/buckets/:id/file-ids/:name', this.getLimiter(limiter(1000)), this._validate, this._verify, this.getFileId],
    ['GET', '/buckets/:id/files/:file', this.getLimiter(limiter(1000)), this._validate, this._usetokenOrVerify, this.getFile],
    ['DELETE', '/buckets/:id/files/:file', this.getLimiter(limiter(1000)), this._validate, this._verify, this.removeFile],
    ['GET', '/buckets/:id/files/:file/info', this.getLimiter(limiter(1000)), this._validate, this.getFileInfo],
    ['POST', '/buckets/:id/files', this.getLimiter(limiter(1000)), this._validate, this._verify, this.createEntryFromFrame],
    ['GET', '/buckets/:id/files/:file/mirrors', this.getLimiter(limiter(1000)), this._validate, this._verify, this.listMirrorsForFile]
  ];
};

module.exports = BucketsRouter;
