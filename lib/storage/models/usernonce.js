'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');

/**
 * Represents a unique user & nonce
 * @constructor
 */
var UserNonce = new mongoose.Schema({
  user: {
    type: mongoose.SchemaTypes.Email,
    ref: 'User',
    required: true
  },
  nonce: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: '5m'
  }
});

UserNonce.plugin(SchemaOptions);

UserNonce.index({ user: 1, nonce: 1 }, { unique: true });

module.exports = function(connection) {
  return connection.model('UserNonce', UserNonce);
};
