/**
 * @class metadisk/models/bucket
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Represents a storage bucket
 * @constructor
 */
var Bucket = new mongoose.Schema({
  storage: {
    type: Number,
    default: 10
  },
  transfer: {
    type: Number,
    default: 30
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive']
  },
  pubkeys: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PublicKey'
  }],
  name: {
    type: String,
    default: 'New Bucket'
  },
  created: {
    type: Date,
    default: Date.now
  }
});

module.exports = function(connection) {
  return connection.model('Bucket', Bucket);
};
