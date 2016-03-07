'use strict';

const mongoose = require('mongoose');
const mimetypes = require('mime-db');
const options = require('../options');

/**
 * Represents a file pointer
 * @constructor
 */
var FileSchema = new mongoose.Schema({
  _id: { // hash
    type: String,
    required: true
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
  filename: {
    type: String
  },
  size: {
    type: Number,
    min: 0,
    default: 0
  }
});

options.apply(FileSchema, {
  read: 'secondaryPreferred'
});

FileSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

FileSchema.virtual('hash').get(function() {
  return this._id;
});

module.exports = function(connection) {
  return connection.model('File', FileSchema);
};
