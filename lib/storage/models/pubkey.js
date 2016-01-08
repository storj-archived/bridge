/**
 * @class metadisk/models/pubkey
 */

'use strict';

var mongoose = require('mongoose');

/**
 * Represents a public key
 * @constructor
 */
var PublicKey = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  key: {
    type: String,
    required: true
  }
});

module.exports = function(connection) {
  return connection.model('PublicKey', PublicKey);
};
