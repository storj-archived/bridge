/**
 * @module metadisk/routes/pubkeys
 */

'use strict';

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function PublicKeysRouterFactory(storage, network) {

  const PublicKey = storage.models.PublicKey;

  /**
   * Returns a list of pubkeys for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getPublicKeys(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Registers a new public key for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function addPublicKey(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Destroys the user's public key
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function destroyPublicKey(req, res, next) {
    next(new Error('Method not implemented'));
  }

  return [
    ['GET'    , '/keys'         , getPublicKeys],
    ['POST'   , '/keys'         , addPublicKey],
    ['DELETE' , '/keys/:pubkey' , destroyPublicKey],
  ];
}

module.exports = PublicKeysRouterFactory;
