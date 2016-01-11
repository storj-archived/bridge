/**
 * @module metadisk/routes/users
 */

'use strict';

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function UsersRouterFactory(storage, network) {

  const User = storage.models.User;

  /**
   * Registers a new user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function createUser(req, res, next) {
    next(new Error('Method not implemented'));
  }

  return [
    ['POST', '/users', createUser],
  ];
}

module.exports = UsersRouterFactory;
