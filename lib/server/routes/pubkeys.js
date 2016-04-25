'use strict';

const authenticate = require('../middleware').authenticate;
const log = require('../../logger');
const errors = require('../errors');

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 */
function PublicKeysRouterFactory(config, storage) {

  const PublicKey = storage.models.PublicKey;
  const verify = authenticate(storage);

  /**
   * Returns a list of pubkeys for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getPublicKeys(req, res, next) {
    log.info('getting public keys for %s', req.user._id);

    PublicKey.find({ user: req.user._id }, function(err, pubkeys) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      res.send(pubkeys.map(function(pubkey) {
        return pubkey.toObject();
      }));
    });
  }

  /**
   * Registers a new public key for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function addPublicKey(req, res, next) {
    log.info('registering public key for %s', req.user._id);

    PublicKey.create(req.user, req.body.key, function(err, pubkey) {
      if (err) {
        if (err.code) {
          // This is a MongoDB error
          return next(new errors.InternalError(err.message));
        } else {
          return next(new errors.BadRequestError(err.message));
        }
      }

      res.send(pubkey.toObject());
    });
  }

  /**
   * Destroys the user's public key
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function destroyPublicKey(req, res, next) {
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

        res.status(200).end();
      });
    });
  }

  return [
    ['GET'    , '/keys'         , verify , getPublicKeys],
    ['POST'   , '/keys'         , verify , addPublicKey],
    ['DELETE' , '/keys/:pubkey' , verify , destroyPublicKey],
  ];
}

module.exports = PublicKeysRouterFactory;
