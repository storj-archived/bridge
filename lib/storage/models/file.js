/**
 * @class metadisk/models/file
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Represents a public key
 * @constructor
 */
var File = new mongoose.Schema({
  bucket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bucket'
  },
  hash: {
    type: String,
    required: true
  },
  shards: [{ type: String }]
});

File.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    delete ret.shards;
  }
});

module.exports = function(connection) {
  return connection.model('File', File);
};
