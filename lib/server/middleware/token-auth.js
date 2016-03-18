/**
 * @module metadisk/server/middleware/authenticate
 */

'use strict';

function TokenMiddlewareFactory(storage) {
  const Token = storage.models.Token;

  return function tokenauth(req, res, next) {
    Token.lookup(req.header('x-token'), function(err, token) {
      if (err) {
        return next(err);
      }

      req.token = token;

      token.expire(next);
    });
  };
}

module.exports = TokenMiddlewareFactory;
