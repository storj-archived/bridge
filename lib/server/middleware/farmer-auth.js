'use strict';

const storj = require('storj-lib');
const errors = require('storj-service-error-types');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');

const THRESHOLD = 300000;

function isHexString(a) {
  if (typeof a !== 'string') {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(a);
}

function getSigHash(req) {
  const hasher = crypto.createHash('sha256');
  const timestamp = req.headers('x-node-timestamp');
  const url = req.protocol + '://' + req.get('host') + req.originalUrl;
  hasher.update(req.method);
  hasher.update(url);
  hasher.update(timestamp);
  hasher.update(Buffer.from(req.rawbody, 'utf8'));
  return hasher.digest();
}

function checkSig(req) {
  const sighash = getSigHash(req);
  const sig = secp256k1.signatureImport(req.headers('x-node-signature'));
  const pubkey = Buffer.from(req.headers('x-node-pubkey'), 'hex');
  return secp256k1.verify(sighash, sig, pubkey);
}

function checkPubkey(req) {
  const pubkey = Buffer.from(req.headers('x-node-pubkey'), 'hex');
  return secp256k1.publicKeyVerify(pubkey);
}

function checkTimestamp(req) {
  const timestamp = parseInt(req.headers('timestamp'));
  if (!Number.isSafeInteger(timestamp)) {
    return false;
  }
  const now = Date.now();
  if (timestamp < now - THRESHOLD || timestamp > now + THRESHOLD) {
    return false;
  }
  return true;
}

function checkNodeID(nodeID, pubkey) {
  if (!nodeID || nodeID.length !== 40 || !isHexString(nodeID)) {
    return false;
  }
  const sha256 = crypto.createHash('sha256');
  const rmd160 = crypto.createHash('rmd160');
  sha256.update(Buffer.from(pubkey, 'hex'));
  rmd160.update(sha256.digest());
  if (rmd160.digest('hex') !== nodeID) {
    return false;
  }
  return true;
}

function authFarmer(req, res, next) {
  const nodeID = req.headers('x-node-id');
  const timestamp = req.headers('x-node-timestamp');
  const pubkey = req.headers('x-node-pubkey');
  const sig = req.headers('x-node-signature');

  if (!module.exports.checkTimestamp(timestamp)) {
    return next(new errors.BadRequestError('Invalid timestamp header'));
  }

  if (!module.exports.checkPubkey(pubkey)) {
    return next(new errors.BadRequestError('Invalid pubkey header'));
  }

  if (!module.exports.checkNodeID(nodeID, pubkey)) {
    return next(new errors.BadRequestError('Invalid nodeID header'));
  }

  if (!req.rawbody || !req.body) {
    return next(new errors.BadRequestError('Missing body from request'));
  }

  if (!module.exports.checkSig(sig)) {
    return next(new errors.BadRequestError('Invalid signature header'));
  }

  next();
}

module.exports = {
  authFarmer: authFarmer,
  checkTimestamp: checkTimestamp,
  checkNodeID: checkNodeID,
  checkPubkey: checkPubkey,
  checkSig: checkSig
}
