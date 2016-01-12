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
function UsersRouterFactory(storage) {

  const User = storage.models.User;

  /**
   * Registers a new user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function createUser(req, res, next) {
    User.create(req.body.email, req.body.password, function(err, user) {
      if (err) {
        return next(err);
      }

      res.send(user.toObject());
    });
  }

  return [
    ['POST', '/users', createUser],
  ];
}

module.exports = UsersRouterFactory;
