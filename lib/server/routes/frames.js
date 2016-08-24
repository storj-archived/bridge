'use strict';

const storj = require('storj');
const async = require('async');
const authenticate = require('../middleware').authenticate;
const errors = require('../errors');
const Router = require('./index');
const inherits = require('util').inherits;
const ms = require('ms');
const log = require('../../logger');
const Auditor = require('../../audit').interface;

/**
 * Handles endpoints for all frame/file staging related operations
 * @constructor
 * @extends {Router}
 * @param {Config} config
 * @param {Storage} storage
 * @param {Network} network
 * @param {Mailer} mailer
 */
function FramesRouter(config, storage, network, mailer) {
  if (!(this instanceof FramesRouter)) {
    return new FramesRouter(config, network, storage, mailer);
  }

  Router.apply(this, arguments);
  this._auditor = new Auditor();
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

  Frame.create(req.user, function(err, frame) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.send(frame.toObject());
  });
};

/**
 * Negotiates a contract and updates persistence for the given contract data
 * @param {storj.Contract} contract - The contract object to publish
 * @param {storj.AuditStream} audit - The audit object to add to persistence
 * @param {Array} blacklist - Do not accept offers from these nodeIDs
 * @param {Function} callback - Called with error or (farmer, contract)
 */
FramesRouter.prototype._getContractForShard = function(contr, audit, bl, done) {
  const self = this;
  const hash = contr.get('data_hash');

  self.network._manager.load(hash, function(err, item) {
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

      self.network._manager.save(item, function(err) {
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

  async.waterfall([
    ensureFrameExists,
    createPointer,
    getShardContract,
    getConsignToken,
    createAuditSchedule.bind(this),
    pushShardsToFrame,
    saveFrame
  ],
    function done(err, result) {
      if(err) {return next(err);}

      res.send({
        hash: req.body.hash,
        token: result.token,
        operation: 'PUSH',
        farmer: result.farmer
      });
    }
  );

  function ensureFrameExists(cb) {
    Frame.count({
      _id: req.params.frame,
      user: req.user._id
    }, function(err, count) {
      if (err) {
        return cb(new errors.InternalError(err.message));
      }

      if (count < 1) {
        return cb(new errors.NotFoundError());
      }

      return cb(null);
    });
  }

  function createPointer(cb) {
    Pointer.create(req.body, function(err, pointer) {
      if (err) {
        return cb(new errors.BadRequestError(err));
      }
      return cb(null, pointer)
    });
  }

  function getShardContract(pointer, cb) {
    let contr = new storj.Contract({
      data_size: req.body.size,
      data_hash: req.body.hash,
      store_begin: Date.now(),
      store_end: Date.now() + ms('90d'),
      audit_count: req.body.challenges.length
    });

    let bl = Array.isArray(req.body.exclude) ? req.body.exclude : [];
    let audit;
    try {
      audit = storj.AuditStream.fromRecords(
        req.body.challenges,
        req.body.tree
      );
    } catch (err) {
      return cb(new errors.BadRequestError(err.message));
    }

    log.debug('Getting contract for shard...');
    self._getContractForShard(contr, audit, bl, function(err, farmer, contr) {
      if (err) {
        log.debug('Error getting contract for shard: %s', err);
        return cb(new errors.InternalError(err.message));
      }

      log.debug('Successfully got contract for shard!');
      return cb(null, pointer, audit, farmer, contr);
    });
  }

  function getConsignToken(pointer, audit, farmer, contr, cb) {
    self.network.getConsignToken(farmer, contr, audit, function(err, token) {
      if (err) {
        return cb(new errors.InternalError(err.message));
      }

      log.debug('Got consign token, saving the frame and sending...');
      return cb(null, pointer, audit, farmer, contr, token);
    });
  }

  function createAuditSchedule(pointer, audit, farmer, contr, token, cb) {
    var auditRecord = audit.getPrivateRecord();

    this._auditor.add(
      this._auditor.createAuditJobs({
        farmer: contr.farmer_id,
        hash: contr.data_hash,
        root: auditRecord.root,
        depth: auditRecord.depth,
        challenges: auditRecord.challenges,
        start: contr.store_begin,
        end: contr.store_end
      }),
      function(err, count) {
        if (err) {
          return cb(new errors.InternalError(err.message));
        }

        return cb(null, pointer, farmer, token);
    });
  }

  function pushShardsToFrame(pointer, farmer, token, cb) {
    Frame.findOne({
      _id: req.params.frame,
      user: req.user._id
    }).populate('shards').exec(function(err, frame) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      for (let i = 0; i < frame.shards.length; i++) {
        if (frame.shards[i].index === req.body.index) {
          frame.shards.splice(i, 1);
          break;
        }
      }

      frame.size += pointer.size;
      frame.shards.push(pointer);
      return cb(null, farmer, token, frame);
    });
  }

  function saveFrame(farmer, token, frame, cb) {
    frame.save(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      return cb(null, {
        farmer: farmer,
        token: token
      });
    });
  }
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
        return next(new errors.NotFoundError());
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
      return next(new errors.NotFoundError());
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
