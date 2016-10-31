'use strict';

const Router = require('./index');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const log = require('../../logger');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all key related operations
 * @constructor
 * @extends {Router}
 */
function PublicKeysRouter(options) {
  if (!(this instanceof PublicKeysRouter)) {
    return new PublicKeysRouter(options);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
}

inherits(PublicKeysRouter, Router);

/**
 * Returns a list of pubkeys for the user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
PublicKeysRouter.prototype.getPublicKeys = function(req, res, next) {
  const PublicKey = this.storage.models.PublicKey;

  log.info('getting public keys for %s', req.user._id);

  PublicKey.find({ user: req.user._id }, function(err, pubkeys) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.send(pubkeys.map(function(pubkey) {
      return pubkey.toObject();
    }));
  });
};

/**
 * Registers a new public key for the user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
PublicKeysRouter.prototype.addPublicKey = function(req, res, next) {
  const PublicKey = this.storage.models.PublicKey;

  log.info('registering public key for %s', req.user._id);

  PublicKey.create(
    req.user,
    req.body.key,
    req.body.label,
    function(err, pubkey) {
      if (err) {
        if (err.code) {
          // This is a MongoDB error
          return next(new errors.InternalError(err.message));
        } else {
          return next(new errors.BadRequestError(err.message));
        }
      }

      res.send(pubkey.toObject());
    }
);
};

/**
 * Destroys the user's public key
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
PublicKeysRouter.prototype.destroyPublicKey = function(req, res, next) {
  const PublicKey = this.storage.models.PublicKey;

  log.info('destroying public key for %s', req.user._id);

  PublicKey.findOne({
    user: req.user._id,
    _id: req.params.pubkey
  }, function(err, pubkey) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!pubkey) {
      return next(new errors.NotFoundError('Public key was not found'));
    }

    pubkey.remove(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      res.status(204).end();
    });
  });
};

/**
 * Export definitions
 * @private
 */
PublicKeysRouter.prototype._definitions = function() {
  return [
    ['GET', '/keys', this._verify, this.getPublicKeys],
    ['POST', '/keys', this._verify, this.addPublicKey],
    ['DELETE', '/keys/:pubkey', this._verify , this.destroyPublicKey]
  ];
};

module.exports = PublicKeysRouter;
