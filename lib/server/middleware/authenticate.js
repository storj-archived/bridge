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

    if (creds && creds.name && creds.pass) {
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
      key: req.header('x-pubkey')
    }).populate('user').exec(function(err, pubkey) {
      if (err) {
        return next(err);
      }

      if (!pubkey) {
        return next(new Error('Public key not registered'));
      }

      if (!pubkey.user) {
        return next(new Error('User not found'));
      }

      if (req.body.__nonce < pubkey.user.__nonce) {
        return next(new Error('Invalid nonce supplied'));
      }

      pubkey.user.__nonce = req.body.__nonce;

      req.user = pubkey.user;
      req.pubkey = pubkey;

      pubkey.user.save(next);
    });
  };
}

module.exports = AuthenticateMiddlewareFactory;
