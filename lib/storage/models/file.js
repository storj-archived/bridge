/**
 * @class metadisk/models/file
 */

'use strict';

const mongoose = require('mongoose');
const mimetypes = require('mime-db');

/**
 * Represents a file pointer
 * @constructor
 */
var FileSchema = new mongoose.Schema({
  bucket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bucket'
  },
  hash: {
    type: String,
    required: true
  },
  shards: [String],
  mimetype: {
    type: String,
    enum: Object.keys(mimetypes),
    default: 'application/octet-stream',
    required: true
  },
  filename: {
    type: String
  },
  size: {
    type: Number,
    min: 0,
    default: 0
  }
});

FileSchema.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

module.exports = function(connection) {
  return connection.model('File', FileSchema);
};
