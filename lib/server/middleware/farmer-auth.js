'use strict';

const storj = require('storj-lib');
const errors = require('storj-service-error-types');

function getSigHash() {

}

function checkSig() {

}

function checkPubkey() {

}

function checkTimestamp() {

}

function authFarmer(req, res, next) {
  const nodeID = req.headers('x-node-id');
  const timestamp req.headers('x-node-timestamp');
  const pubkey = req.headers('x-node-pubkey');
  const sig = req.headers('x-node-signature');

  if (!nodeID || nodeID.length !== 40 || !storj.utils.isHexaString(nodeID)) {
    return next(new errors.BadRequestError('Invalid nodeID header'));
  }

  if (!module.exports.checkTimestamp(timestamp)) {
    return next(new errors.BadRequestError('Invalid timestamp header'));
  }

  if (!module.exports.checkPubkey(pubkey)) {
    return next(new errors.BadRequestError('Invalid pubkey header'));
  }

  if (!module.exports.checkSig(sig)) {
    return next(new errors.BadRequestError('Invalid signature header'));
  }

  next();

}

module.exports = {
  authFarmer: authFarmer,
  checkTimestamp: checkTimestamp,
  checkPubkey: checkPubkey,
  checkSig: checkSig
}
