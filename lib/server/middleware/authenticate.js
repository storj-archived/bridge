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
  const fromBody = ['POST', 'PATCH', 'PUT'];
  const fromQuery = ['GET', 'DELETE', 'OPTIONS'];

  function _getPayload(req) {
    if (fromBody.indexOf(req.method) !== -1) {
      return req.rawbody;
    }

    if (fromQuery.indexOf(req.method) !== -1) {
      return url.parse(req.url).query;
    }

    return '';
  }

  function _getParams(req) {
    if (fromBody.indexOf(req.method) !== -1) {
      return req.body;
    }

    if (fromQuery.indexOf(req.method) !== -1) {
      return req.query;
    }

    return {};
  }

  function authenticate(req, res, next) {
    let creds = basicauth(req);

    if (creds && creds.name && creds.pass) {
      return User.lookup(creds.name, creds.pass, function(err, user) {
        if (err) {
          return next(err);
        }

        if (!user.activated) {
          return next(new Error('User account has not been activated'));
        }

        req.user = user;

        next();
      });
    }

    let signature;
    let pubkey;
    let contract = new Buffer([
      req.method,
      req.path,
      _getPayload(req)
    ].join('\n'), 'utf8');

    try {
      signature = new Buffer(req.header('x-signature'), 'hex');
      pubkey = ecdsa.keyFromPublic(req.header('x-pubkey'), 'hex');
    } catch (e) {
      return next(new Error('Invalid signature or public key supplied'));
    }

    let verified = ecdsa.verify(
      crypto.createHash('sha256').update(contract).digest('hex'),
      signature,
      pubkey
    );

    if (!verified) {
      return next(new Error('Invalid signature'));
    }

    PublicKey.findOne({
      _id: req.header('x-pubkey')
    }).exec(function(err, pubkey) {
      if (err) {
        return next(err);
      }

      if (!pubkey) {
        return next(new Error('Public key not registered'));
      }

      let params = _getParams(req);

      User.findOne({ _id: pubkey.user }, function(err, user) {
        if (err) {
          return next(err);
        }

        if (!user) {
          return next(new Error('User not found'));
        }

        if (!params.__nonce || params.__nonce < user.__nonce) {
          return next(new Error('Invalid nonce supplied'));
        }

        user.__nonce = params.__nonce;

        req.user = user;
        req.pubkey = pubkey;

        user.save(next);
      });
    });
  }

  return [require('./rawbody'), authenticate];
}

module.exports = AuthenticateMiddlewareFactory;
