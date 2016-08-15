/**
 * @module storj-bridge/server/middleware/authenticate
 */

'use strict';

const errors = require('../errors');
const url = require('url');
const crypto = require('crypto');
const elliptic = require('elliptic');
const basicauth = require('basic-auth');
const ecdsa = new elliptic.ec(elliptic.curves.secp256k1);
const fromBody = ['POST', 'PATCH', 'PUT'];
const fromQuery = ['GET', 'DELETE', 'OPTIONS'];

function AuthenticateMiddlewareFactory(storage) {
  const PublicKey = storage.models.PublicKey;
  const User = storage.models.User;
  const UserNonce = storage.models.UserNonce;

  function authenticate(req, res, next) {
    let strategy = AuthenticateMiddlewareFactory._detectStrategy(req);

    switch (strategy) {
      case 'BASIC':
        let creds = basicauth(req);
        User.lookup(creds.name, creds.pass, function(err, user) {
          if (err) {
            return next(err);
          }

          if (!user.activated) {
            return next(new errors.NotAuthorizedError(
              'User account has not been activated'
            ));
          }

          req.user = user;

          next();
        });
        break;
      case 'ECDSA':
        if (!AuthenticateMiddlewareFactory._verifySignature(req)) {
          return next(new errors.NotAuthorizedError('Invalid signature'));
        }

        PublicKey.findOne({
          _id: req.header('x-pubkey')
        }).exec(function(err, pubkey) {
          if (err) {
            return next(err);
          }

          if (!pubkey) {
            return next(new errors.NotAuthorizedError(
              'Public key not registered'
            ));
          }

          let params = AuthenticateMiddlewareFactory._getParams(req);

          User.findOne({ _id: pubkey.user }, function(err, user) {
            if (err) {
              return next(err);
            }

            if (!user) {
              return next(new errors.NotAuthorizedError('User not found'));
            }

            if (!user.activated) {
              return next(new errors.NotAuthorizedError(
                'User account has not been activated'
              ));
            }

            var userNonce = new UserNonce({
              user: user.id,
              nonce: params.__nonce
            });

            userNonce.save(function(err) {
              if (err && err.code === '11000') {
                return next(new errors.NotAuthorizedError(
                  'Invalid nonce supplied'
                ));
              }

              req.user = user;
              req.pubkey = pubkey;

              return next(err);
            });
          });
        });
        break;
      case 'NONE':
        next(new errors.NotAuthorizedError(
          'No authentication strategy detected'
        ));
        break;
      default:
        next(new errors.NotAuthorizedError(
          'No authentication strategy detected'
        ));
    }
  }

  return [require('./rawbody'), authenticate];
}

/**
 * Returns a string representation of the auth type detected
 * @private
 * @param {http.IncomingMessage} req
 * @returns {String}
 */
AuthenticateMiddlewareFactory._detectStrategy = function(req) {
  let creds = basicauth(req);
  let basic = creds && creds.name && creds.pass;
  let ecdsa = req.header('x-signature') && req.header('x-pubkey');
  let strategy = basic ? 'BASIC' : (ecdsa ? 'ECDSA' : 'NONE');

  return strategy;
};

/**
 * Extracts the payload for signature verification
 * @private
 * @param {http.IncomingMessage} req
 * @returns {String}
 */
AuthenticateMiddlewareFactory._getPayload = function(req) {
  if (fromBody.indexOf(req.method) !== -1) {
    return req.rawbody;
  }

  if (fromQuery.indexOf(req.method) !== -1) {
    return url.parse(req.url).query;
  }

  return '';
};

/**
 * Extracts the request parameters
 * @private
 * @param {http.IncomingMessage} req
 * @returns {Object}
 */
AuthenticateMiddlewareFactory._getParams = function(req) {
  if (fromBody.indexOf(req.method) !== -1) {
    return req.body;
  }

  if (fromQuery.indexOf(req.method) !== -1) {
    return req.query;
  }

  return {};
};

AuthenticateMiddlewareFactory._verifySignature = function(req) {
  let signature;
  let pubkey;
  // console.log('req.method: ', req.method);
  // console.log('req.path: ', req.path);
  // console.log('payload: ', AuthenticateMiddlewareFactory._getPayload(req));
  let contract = new Buffer([
    req.method,
    req.path,
    AuthenticateMiddlewareFactory._getPayload(req)
  ].join('\n'), 'utf8');
  console.log('contract: ', contract.toString());

  try {
    signature = new Buffer(req.header('x-signature'), 'hex');
    pubkey = ecdsa.keyFromPublic(req.header('x-pubkey'), 'hex');
  } catch (e) {
    return false;
  }

  return ecdsa.verify(
    crypto.createHash('sha256').update(contract).digest('hex'),
    signature,
    pubkey
  );
};

module.exports = AuthenticateMiddlewareFactory;
