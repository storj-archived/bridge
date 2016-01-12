/**
 * @module metadisk/server/middleware/authenticate
 */

'use strict';

const url = require('url');
const crypto = require('crypto');
const elliptic = require('elliptic');
const basicauth = require('basic-auth');
const ecdsa = new elliptic.ec(elliptic.curves.secp256k1);

function AuthenticateMiddlewareFactory(storage) {
  const PublicKey = storage.models.PublicKey;
  const User = storage.models.User;

  function _getPayload(req) {
    var fromBody = ['POST', 'PATCH', 'PUT'];
    var fromQuery = ['GET', 'DELETE', 'OPTIONS'];

    if (fromBody.indexOf(req.method) !== -1) {
      return req.rawbody;
    }

    if (fromQuery.indexOf(req.method) !== -1) {
      return url.parse(req.url).query;
    }

    return '';
  }

  return function authenticate(req, res, next) {
    let creds = basicauth(req);

    if (creds.name && creds.pass) {
      return User.lookup(creds.name, creds.pass, function(err, user) {
        if (err) {
          return next(err);
        }

        req.user = user;

        next();
      });
    }

    let contract = new Buffer([
      req.method,
      req.path,
      _getPayload(req)
    ].join('\n'), 'utf8');

    let signature = new Buffer(req.header('x-signature'), 'hex');
    let pubkey = new Buffer(req.header('x-pubkey'), 'hex');

    let verified = ecdsa.verify(
      crypto.createHash('sha256').update(contract).digest('hex'),
      signature,
      pubkey
    );

    if (!verified) {
      return next(new Error('Invalid signature'));
    }

    PublicKey.findOne({
      key: pubkey
    }).populate('user').exec(function(err, user) {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next(new Error('User not found'));
      }

      if (req.body.__nonce < user.__nonce) {
        return next(new Error('Invalid nonce supplied'));
      }

      user.__nonce = req.body.__nonce;
      req.user = user;

      user.save(next);
    });
  };
}

module.exports = AuthenticateMiddlewareFactory;
