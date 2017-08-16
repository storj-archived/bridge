'use strict';

const async = require('async');
const storj = require('storj-lib');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const errors = require('storj-service-error-types');
const Router = require('./index');
const inherits = require('util').inherits;
const ms = require('ms');
const log = require('../../logger');
const constants = require('../../constants');
const analytics = require('storj-analytics');
const limiter = require('../limiter').DEFAULTS;

/**
 * Handles endpoints for all frame/file staging related operations
 * @constructor
 * @extends {Router}
 */
function FramesRouter(options) {
  if (!(this instanceof FramesRouter)) {
    return new FramesRouter(options);
  }

  Router.apply(this, arguments);
  this._defaults = options.config.application;
  this._verify = authenticate(this.storage);
  this.getLimiter = middleware.rateLimiter(options.redis);
}

inherits(FramesRouter, Router);

/**
 * Creates a file staging frame
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.createFrame = function(req, res, next) {
  const Frame = this.storage.models.Frame;

  const rates = this.config.application.freeTier.up;
  if (req.user.isUploadRateLimited(rates.hourlyBytes,
                                   rates.dailyBytes,
                                   rates.monthlyBytes)) {
    log.warn('createFrame: Transfer rate limited, user: %s', req.user.email);
    analytics.track(req.headers.dnt, {
      userId: req.user.uuid,
      event: 'User Upload Rate Limited',
      properties: {
        monthlyBytes: req.user.bytesUploaded.lastMonthBytes,
        dailyBytes: req.user.bytesUploaded.lastDayBytes,
        hourlyBytes: req.user.bytesUploaded.lastHourBytes
      }
    });
    return next(new errors.TransferRateError(
      'Could not create frame, transfer rate limit reached.'
    ));
  }

  analytics.track(req.headers.dnt, {
    userId: req.user.uuid,
    event: 'Frame Created'
  });

  Frame.create(req.user, function(err, frame) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.send(frame.toObject());
  });
};

/**
 * Negotiates a contract and updates persistence for the given contract data
 * @private
 * @param {storj.Contract} contract - The contract object to publish
 * @param {storj.AuditStream} audit - The audit object to add to persistence
 * @param {Array} blacklist - Do not accept offers from these nodeIDs
 * @param {Object} res - The associated response
 * @param {Function} callback - Called with error or (farmer, contract)
 */
FramesRouter.prototype._getContractForShard = function(contr, audit, bl, res, done) {
  const self = this;
  const hash = contr.get('data_hash');

  self.contracts.load(hash, function(err, item) {
    if (err) {
      item = new storj.StorageItem({ hash: hash });
    }

    self.network.getStorageOffer(contr, bl, function(err, farmer, contract) {
      if (err) {
        return done(err);
      }

      // NB: This can happen even if the client times out and the contract
      // would be added to the item even though the client never had a chance
      // to upload the data to the farmer
      if (res.socket.destroyed) {
        return;
      }

      item.addContract(farmer, contract);
      item.addAuditRecords(farmer, audit);
      item.addMetaData(farmer, { downloadCount: 0 });

      self.contracts.save(item, function(err) {
        if (err) {
          return done(new errors.InternalError(err.message));
        }

        done(null, farmer, contract);
      });
    });
  });
};

FramesRouter._sortByResponseTime = function(a, b) {
  const aTime = a.contact.responseTime || Infinity;
  const bTime = b.contact.responseTime || Infinity;
  return (aTime === bTime) ? 0 : (aTime > bTime) ? 1 : -1;
};

/**
 * Negotiates a storage contract and adds the shard to the frame
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.addShardToFrame = function(req, res, next) {
  const self = this;
  const Frame = this.storage.models.Frame;
  const Pointer = this.storage.models.Pointer;

  const rates = self.config.application.freeTier.up;
  if (req.user.isUploadRateLimited(rates.hourlyBytes,
                                   rates.dailyBytes,
                                   rates.monthlyBytes)) {
    log.warn('addShardToFrame: Transfer rate limited, user: %s', req.user.email);
    analytics.track(req.headers.dnt, {
      userId: req.user.uuid,
      event: 'User Upload Rate Limited',
      properties: {
        monthlyBytes: req.user.bytesUploaded.lastMonthBytes,
        dailyBytes: req.user.bytesUploaded.lastDayBytes,
        hourlyBytes: req.user.bytesUploaded.lastHourBytes
      }
    });
    return next(new errors.TransferRateError(
      'Could not add shard to frame, transfer rate limit reached.'
    ));
  }

  if (Array.isArray(req.body.exclude) &&
      req.body.exclude.length > constants.MAX_BLACKLIST) {
    return next(new errors.BadRequestError('Maximum blacklist length'));
  }

  let audit;
  let contr;

  try {
    audit = storj.AuditStream.fromRecords(
      req.body.challenges,
      req.body.tree
    );
  } catch (err) {
    return next(new errors.BadRequestError(err.message));
  }

  try {
    contr = new storj.Contract({
      data_size: req.body.size,
      data_hash: req.body.hash,
      store_begin: Date.now(),
      store_end: Date.now() + ms('90d'),
      audit_count: req.body.challenges.length
    });
  } catch(err) {
    return next(new errors.BadRequestError(err.message));
  }

  let bl = Array.isArray(req.body.exclude) ? req.body.exclude : [];
  let frame = null;
  let farmer = null;
  let contract = null;
  let token = null;

  async.series([
    function checkFrame(done) {
      Frame.findOne({
        _id: req.params.frame,
        user: req.user._id
      }, function(err, _frame) {
        if (err) {
          return done(new errors.InternalError(err.message));
        }

        if (!_frame) {
          done(new errors.NotFoundError('Frame not found'));
        } else {
          frame = _frame;
          done();
        }
      });
    },
    function getContract(done) {
      // First check that we don't already have cached offers for this
      // shard from a previous request that timed out with offers that
      // arrived late.

      self.storage.models.Mirror.find({
        shardHash: req.body.hash
      }).populate('contact').exec((err, mirrors) => {
        if (err) {
          log.error(err.message);
        }

        let mirror = null;

        if (mirrors && mirrors.length) {
          const filtered = mirrors.filter((m) => {
            if (!m.contact) {
              log.warn('Mirror %s is missing contact in database', m._id);
              return false;
            } else if (!m.isEstablished) {
              return true;
            }
            return false;
          });

          filtered.sort(FramesRouter._sortByResponseTime);

          mirror = filtered[0];
        }

        if (!mirror) {
          // If we don't have any cached offers go ahead and send out
          // a call into the network for more offers

          log.debug('Requesting contract for frame: %s, shard hash: %s and size: %s',
                    req.params.frame, req.body.hash, req.body.size);

          self._getContractForShard(contr, audit, bl, res, function(err, _farmer, _contract) {
            if (err) {
              log.warn('Could not get contract for frame: %s and ' +
                       'shard hash: %s, reason: %s', req.params.frame,
                       req.body.hash, err.message);
              done(new errors.ServiceUnavailableError(err.message));
            } else {
              farmer = _farmer;
              contract = _contract;
              done();
            }
          });
        } else {

          self.contracts.load(req.body.hash, function(err, item) {
            if (err) {
              item = new storj.StorageItem({ hash: req.body.hash });
            }

            mirror.isEstablished = true;
            mirror.save();

            farmer = storj.Contact(mirror.contact);
            contract = storj.Contract(mirror.contract);

            item.addContract(farmer, contract);
            item.addAuditRecords(farmer, audit);

            self.contracts.save(item, function(err) {
              if (err) {
                return done(new errors.InternalError(err.message));
              }
              done();
            });
          });
        }
      });
    },
    function getToken(done) {
      self.network.getConsignmentPointer(
        farmer, contract, audit,
        function(err, dcPointer) {
          if (err) {
            log.warn('Could not get consignment pointer for frame: %s, ' +
                     'shard hash: %s, reason: %s', req.params.frame,
                     req.body.hash, err.message);
            done(new errors.ServiceUnavailableError(err.message));
          } else {
            token = dcPointer.token;
            done();
          }
        });
    },
    function addPointerToFrame(done) {

      let pointerData = {
        index: req.body.index,
        hash: req.body.hash,
        size: req.body.size,
        tree: req.body.tree,
        parity: req.body.parity,
        challenges: req.body.challenges
      };

      Pointer.create(pointerData, function(err, pointer) {
        if (err) {
          return done(new errors.BadRequestError(err.message));
        }

        // We need to reload the frame to get the latest copy
        Frame.findOne({
          _id: frame._id
        }).populate('shards').exec(function(err, frame) {
          if (err) {
            return done(new errors.InternalError(err.message));
          }

          req.user.recordUploadBytes(pointer.size, (err) => {
            if (err) {
              log.warn(
                'addShardToFrame: unable to save upload bytes %s, ' +
                  'user: %s, reason: %s', pointer.size, req.user.email,
                err.message
              );
            }
          });

          frame.addShard(pointer, (err) => {
            if (err) {
              return done(new errors.InternalError(err.message));
            }
            res.send({
              hash: req.body.hash,
              token: token,
              operation: 'PUSH',
              farmer: farmer
            });
          });
        });
      });
    }
  ], next);
};

/**
 * Destroys the file staging frame if it is not in use by a bucket entry
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.destroyFrameById = function(req, res, next) {
  const BucketEntry = this.storage.models.BucketEntry;
  const Frame = this.storage.models.Frame;

  BucketEntry.findOne({
    user: req.user._id,
    frame: req.params.frame
  }, function(err, entry) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (entry) {
      return next(new errors.BadRequestError(
        'Refusing to destroy frame that is referenced by a bucket entry'
      ));
    }

    Frame.findOne({
      user: req.user._id,
      _id: req.params.frame
    }, function(err, frame) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!frame) {
        return next(new errors.NotFoundError('Frame not found'));
      }

      frame.remove(function(err) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(204).end();
      });
    });
  });
};

/**
 * Returns the caller's file staging frames
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.getFrames = function(req, res, next) {
  const Frame = this.storage.models.Frame;

  Frame.find({ user: req.user._id }).limit(10).exec(function(err, frames) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.send(frames.map(function(frame) {
      return frame.toObject();
    }));
  });
};

/**
 * Returns the file staging frame by it's ID
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.getFrameById = function(req, res, next) {
  const Frame = this.storage.models.Frame;

  Frame.findOne({
    user: req.user._id,
    _id: req.params.frame
  }, function(err, frame) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!frame) {
      return next(new errors.NotFoundError('Frame not found'));
    }

    res.send(frame.toObject());
  });
};



/**
 * Export definitions
 * @private
 */
FramesRouter.prototype._definitions = function() {
  /* jshint maxlen: 140 */
  return [
    ['POST', '/frames', this.getLimiter(limiter(1000)), this._verify, this.createFrame],
    ['PUT', '/frames/:frame', this.getLimiter(limiter(this._defaults.shardsPerMinute)), this._verify, this.addShardToFrame],
    ['DELETE', '/frames/:frame', this.getLimiter(limiter(1000)), this._verify, this.destroyFrameById],
    ['GET', '/frames', this.getLimiter(limiter(1000)), this._verify, this.getFrames],
    ['GET', '/frames/:frame', this.getLimiter(limiter(1000)), this._verify, this.getFrameById]
  ];
};

module.exports = FramesRouter;
