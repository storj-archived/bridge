'use strict';

const storj = require('storj-lib');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const errors = require('storj-service-error-types');
const Router = require('./index');
const inherits = require('util').inherits;
const ms = require('ms');
const log = require('../../logger');

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

  this._verify = authenticate(this.storage);
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
    return next(new errors.TransferRateError(
      'Could not create frame, transfer rate limit reached.'
    ));
  }

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
 * @param {Function} callback - Called with error or (farmer, contract)
 */
FramesRouter.prototype._getContractForShard = function(contr, audit, bl, done) {
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
    return next(new errors.TransferRateError(
      'Could not add shard to frame, transfer rate limit reached.'
    ));
  }

  Frame.findOne({
    _id: req.params.frame,
    user: req.user._id
  }, function(err, frame) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!frame) {
      return next(new errors.NotFoundError('Frame not found'));
    }

    let pointerData = {
      index: req.body.index,
      hash: req.body.hash,
      size: req.body.size,
      tree: req.body.tree,
      challenges: req.body.challenges
    };

    Pointer.create(pointerData, function(err, pointer) {
      if (err) {
        return next(new errors.BadRequestError(err.message));
      }

      let audit;

      try {
        audit = storj.AuditStream.fromRecords(
          req.body.challenges,
          req.body.tree
        );
      } catch (err) {
        return next(new errors.BadRequestError(err.message));
      }

      let contr = new storj.Contract({
        data_size: req.body.size,
        data_hash: req.body.hash,
        store_begin: Date.now(),
        store_end: Date.now() + ms('90d'),
        audit_count: req.body.challenges.length
      });
      let bl = Array.isArray(req.body.exclude) ? req.body.exclude : [];

      log.debug('Getting contract for shard...');
      self._getContractForShard(contr, audit, bl, function(err, farmer, contr) {
        if (err) {
          log.debug('Error getting contract for shard: %s', err);
          return next(new errors.InternalError(err.message));
        }

        log.debug('Successfully got contract for shard!');

        self.network.getConsignmentPointer(
          farmer,
          contr,
          audit,
          function(err, dcPointer) {
            if (err) {
              return next(new errors.InternalError(err.message));
            }

            log.debug('Got consign token, saving the frame and sending...');

            // We need to reload the frame to get the latest copy
            Frame.findOne({
              _id: frame._id
            }).populate('shards').exec(function(err, frame) {
              if (err) {
                return next(new errors.InternalError(err.message));
              }

              let replaced = false;

              for (let i = 0; i < frame.shards.length; i++) {
                if (frame.shards[i].index === req.body.index) {
                  frame.shards.splice(i, 1);
                  replaced = true;
                  break;
                }
              }

              if (!replaced) {
                frame.size += pointer.size;
              }

              // TODO if shard has been replaced, we should invalidate the
              // old contract and make sure that a failure to upload
              // exchange report has been made, or equivalent.

              const user = req.user.recordUploadBytes(pointer.size);
              user.save((err) => {
                if (err) {
                  log.warn(
                    'addShardToFrame: unable to save upload bytes %s, ' +
                      'user: %s, reason: %s', pointer.size, req.user.email,
                    err.message
                  );
                }
              });

              frame.shards.push(pointer);

              frame.save(function(err) {
                if (err) {
                  return next(new errors.InternalError(err.message));
                }

                res.send({
                  hash: req.body.hash,
                  token: dcPointer.token,
                  operation: 'PUSH',
                  farmer: farmer
                });
              });
            });
          }
        );
      });
    });
  });
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

  Frame.find({ user: req.user._id }, function(err, frames) {
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
  return [
    ['POST', '/frames', this._verify, this.createFrame],
    ['PUT', '/frames/:frame', this._verify, this.addShardToFrame],
    ['DELETE', '/frames/:frame', this._verify, this.destroyFrameById],
    ['GET', '/frames', this._verify, this.getFrames],
    ['GET', '/frames/:frame', this._verify, this.getFrameById]
  ];
};

module.exports = FramesRouter;
