/**
 * @module metadisk/routes/pubkeys
 */

'use strict';

const authenticate = require('../middleware').authenticate;

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function PublicKeysRouterFactory(storage) {

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
    PublicKey.find({ user: req.user._id }, function(err, pubkeys) {
      if (err) {
        return next(err);
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
    PublicKey.create(req.user, req.body.key, function(err, pubkey) {
      if (err) {
        return next(err);
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
    PublicKey.findOne({
      user: req.user._id,
      key: req.params.pubkey
    }, function(err, pubkey) {
      if (err) {
        return next(err);
      }

      if (!pubkey) {
        return next(new Error('Public key was not found'));
      }

      pubkey.remove(function(err) {
        if (err) {
          return next(err);
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
