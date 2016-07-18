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
  frame: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frame'
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
  return this.name || this.frame;
});

BucketEntry.index({ bucket: 1 });

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
