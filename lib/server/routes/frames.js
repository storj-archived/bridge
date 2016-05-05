'use strict';

const storj = require('storj');
const authenticate = require('../middleware').authenticate;
const errors = require('../errors');
const Router = require('./index');
const inherits = require('util').inherits;

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
 * Creates a bucket entry from the given frame object
 * @function
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
 * Creates a bucket entry from the given frame object
 * @function
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.addShardToFrame = function(req, res, next) {
  const self = this;
  const Frame = this.storage.models.Frame;

  Frame.findOne({
    _id: req.params.frame,
    user: req.user._id
  }, function(err, frame) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!frame) {
      return next(new errors.NotFoundError());
    }

    let contract = new storj.Contract({
      // TODO: Define the contract based on received data
    });
    let audit = new storj.Audit({
      // TODO: Define the audit object based on received data
    });

    self.network.getStorageOffer(contract, function(farmer, contract) {
      self.network.getConsignToken(
        farmer,
        contract,
        audit,
        function(err, token) {
          if (err) {
            return next(new errors.InternalError(err.message));
          }

          frame.addShard(req.body, function(err) {
            if (err) {
              return next(new errors.BadRequestError(err.message));
            }

            res.send({
              hash: req.body.hash,
              token: token,
              farmer: 'ws://' + farmer.address + ':' + farmer.port
            });
          }
        );
      });
    });
  });
};

/**
 * Creates a bucket entry from the given frame object
 * @function
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
 * Creates a bucket entry from the given frame object
 * @function
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
 * Creates a bucket entry from the given frame object
 * @function
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
