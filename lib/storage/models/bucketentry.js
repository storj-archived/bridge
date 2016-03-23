'use strict';

const ms = require('ms');
const constants = require('../../constants');
const mongoose = require('mongoose');
const mimetypes = require('mime-db');
const SchemaOptions = require('../options');

/**
 * Represents a bucket entry that points to a file
 * @constructor
 */
var BucketEntry = new mongoose.Schema({
  file: {
    type: String,
    ref: 'File'
  },
  bucket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bucket'
  },
  mimetype: {
    type: String,
    enum: Object.keys(mimetypes),
    default: 'application/octet-stream',
    required: true
  },
  name: {
    type: String
  },
  renewal: {
    type: Date,
    default: function() {
      return Date.now() + ms(constants.DEFAULT_FILE_TTL);
    }
  }
});

BucketEntry.virtual('filename').get(function() {
  return this.name || this.file;
});

BucketEntry.index({ file: 1, bucket: 1 }, { unique: true });

BucketEntry.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

BucketEntry.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

module.exports = function(connection) {
  return connection.model('BucketEntry', BucketEntry);
};
