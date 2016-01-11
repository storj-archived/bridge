/**
 * @module metadisk/server/middleware/authenticate
 */

'use strict';

const crypto = require('crypto');
const elliptic = require('elliptic');
const ecdsa = new elliptic.ec(elliptic.curves.secp256k1);

function AuthenticateMiddlewareFactory(storage) {
  const PublicKey = storage.models.PublicKey;

  return function authenticate(req, res, next) {
    let signature = req.header('x-signature');
    let pubkey = req.header('x-pubkey');
    let contract = [req.method, req.path, req.rawbody].join('\n');

    if (!Buffer.isBuffer(contract)) {
     contract = new Buffer(contract, 'utf8');
    }

    if (!Buffer.isBuffer(signature)) {
     signature = new Buffer(signature, 'hex');
    }

    if (!Buffer.isBuffer(pubkey)) {
     pubkey = new Buffer(pubkey, 'hex');
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
