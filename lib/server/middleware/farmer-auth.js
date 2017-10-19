'use strict';

const errors = require('storj-service-error-types');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');

const THRESHOLD = 300000;

function isHexString(a) {
  if (typeof a !== 'string') {
    return false;
  }
  return /^([0-9a-fA-F]{2})+$/.test(a);
}

function getSigHash(req) {
  const hasher = crypto.createHash('sha256');
  const timestamp = req.headers['x-node-timestamp'];
  let proto = req.protocol;
  if (req.headers['x-forwarded-proto']) {
    proto = req.headers['x-forwarded-proto'];
  }
  const url = proto + '://' + req.get('host') + req.originalUrl;
  hasher.update(req.method);
  hasher.update(url);
  hasher.update(timestamp);
  hasher.update(req.rawbody);
  return hasher.digest();
}

function checkSig(req) {
  const sighash = getSigHash(req);
  let sigstr = req.headers['x-node-signature'];
  if (!isHexString(sigstr)) {
    return false;
  }
  const buf = Buffer.from(req.headers['x-node-signature'], 'hex');
  const sig = secp256k1.signatureImport(buf);
  const pubkey = Buffer.from(req.headers['x-node-pubkey'], 'hex');
  return secp256k1.verify(sighash, sig, pubkey);
}

function checkPubkey(pubkey) {
  if (!isHexString(pubkey)) {
    return false;
  }
  const buf = Buffer.from(pubkey, 'hex');
  return secp256k1.publicKeyVerify(buf);
}

function checkTimestamp(ts) {
  const timestamp = parseInt(ts);
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
  const nodeID = req.headers['x-node-id'];
  const timestamp = req.headers['x-node-timestamp'];
  const pubkey = req.headers['x-node-pubkey'];

  if (!module.exports.checkTimestamp(timestamp)) {
    return next(new errors.BadRequestError('Invalid timestamp header'));
  }

  if (!module.exports.checkPubkey(pubkey)) {
    return next(new errors.BadRequestError('Invalid pubkey header'));
  }

  if (!module.exports.checkNodeID(nodeID, pubkey)) {
    return next(new errors.BadRequestError('Invalid nodeID header'));
  }

  if (!req.rawbody || !Buffer.isBuffer(req.rawbody)) {
    return next(new errors.BadRequestError('Invalid body'));
  }

  if (!module.exports.checkSig(req)) {
    return next(new errors.BadRequestError('Invalid signature header'));
  }

  next();
}

module.exports = {
  authFarmer: authFarmer,
  getSigHash: getSigHash,
  isHexString: isHexString,
  checkTimestamp: checkTimestamp,
  checkNodeID: checkNodeID,
  checkPubkey: checkPubkey,
  checkSig: checkSig
};
