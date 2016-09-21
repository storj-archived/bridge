'use strict';

const crypto = require('crypto');

exports.randomHex = function(count) {
  return crypto.randomBytes(count / 8).toString('hex');
};

exports.activator = function(){
  return this.randomHex(256);
};

exports.salt = function(){
  return this.randomHex(64);
};

exports.base64ToHex = function(base64) {
  return Buffer(base64, 'base64').toString('hex');
};

exports.hexToBase64 = function(hex) {
  return Buffer(hex, 'hex').toString('base64');
};
