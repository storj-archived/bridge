'use strict';

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
  next(new errors.NotImplementedError());
};

/**
 * Creates a bucket entry from the given frame object
 * @function
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.addShardToFrame = function(req, res, next) {
  next(new errors.NotImplementedError());
};

/**
 * Creates a bucket entry from the given frame object
 * @function
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.destroyFrameById = function(req, res, next) {
  next(new errors.NotImplementedError());
};

/**
 * Creates a bucket entry from the given frame object
 * @function
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.getFrames = function(req, res, next) {
  next(new errors.NotImplementedError());
};

/**
 * Creates a bucket entry from the given frame object
 * @function
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.getFrameById = function(req, res, next) {
  next(new errors.NotImplementedError());
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
