'use strict';

const storj = require('storj');
const authenticate = require('../middleware').authenticate;
const errors = require('../errors');
const Router = require('./index');
const inherits = require('util').inherits;
const ms = require('ms');
const async = require('async');
const AuditQueue = require('../../audit/queue.js');

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
 * @param {Function} callback - Called with error or (farmer, contract)
 */
FramesRouter.prototype._getContractForShard = function(contract, audit, done) {
  const self = this;
  const hash = contract.get('data_hash');

  self.network._manager.load(hash, function(err, item) {
    if (err) {
      item = new storj.StorageItem({ hash: hash });
    }

    self.network.getStorageOffer(contract, function(farmer, contract) {
      item.addContract(farmer, contract);
      item.addAuditRecords(farmer, audit);

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

  async.waterfalll([
    findFrameDoc,
    addShardToFrameDoc,
    createShardContract,
    getConsignToken,
    createAuditSchedule,
    saveFrameDoc
  ],
  function done(err, result) {
    if(err) log.error(err);
    res.send({
      hash: req.body.hash,
      token: result.token,
      operation: 'PUSH',
      farmer: result.farmer
    });
  });

  function findFrameDoc(next) {
    Frame.findOne({
      _id: req.params.frame,
      user: req.user._id
    }, function(err, frame) {
      if (err) return next(new errors.InternalError(err.message));
      if (!frame) return next(new errors.NotFoundError());
      return next(null, frame);
    });
  }

  function addShardToFrameDoc(frame, next) {
    frame.addShard(req.body, function(err) {
      if (err) return next(new errors.BadRequestError(err.message));
      return next(null, frame);
    });
  }

  function createShardContract(frame, next) {
    let audit;

    try {
      audit = storj.AuditStream.fromRecords(
        req.body.challenges,
        req.body.tree
      );
    } catch (err) {
      return next(new errors.BadRequestError(err.message));
    }

    let contract = new storj.Contract({
      renter_id: self.network._keypair.getNodeID(),
      data_size: req.body.size,
      data_hash: req.body.hash,
      store_begin: Date.now(),
      store_end: Date.now() + ms('90d'),
      audit_count: req.body.challenges.length
    });

    self._getContractForShard(contract, audit, function(err, farmer, contr) {
      if (err) return next(new errors.InternalError(err.message));
      return next(null, farmer, frame, contr, audit);
    });
  }

  function getConsignToken(farmer, frame, contract, audit, next) {
    self.network.getConsignToken(farmer, contr, audit, function(err, t) {
      if (err) return next(new errors.InternalError(err.message));
      next(null, farmer, frame, contract, audit, t);
    });
  }

  function createAuditSchedule(farmer, frame, contract, audit, token, next) {
    let audits = [];
    let sTime = contract.start_time;
    let eTime = contract.end_time;
    let hashKey = contract.renter_id + ':' + contract.hash + ':';

    audit._challenges.forEach(function(elem, ind, arr) {
      let audit = {
        ts      : sTime + ( (eTime - sTime) / (ind / arr.length) ),
        isFinal : (ind === arr.length) ? true : false,
        data    : {
          hash      : contract.hash,
          challenge : elem,
          id        : contract.renter_id
        }
      };
      audits.push(audit);
    });

    auditQueue.add(audits, function(err, resp) {
      if(err) return next(new errors.InternalError(err.message));
      return next(null, farmer, frame, token);
    });
  }

  function saveFrameDoc(farmer, frame, token, next) {
    frame.save(function(err) {
      if (err) return next(new errors.InternalError(err.message));
      return next(null, {
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
