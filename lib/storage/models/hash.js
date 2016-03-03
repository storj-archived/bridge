/**
 * @class metadisk/models/file
 */

'use strict';

const mongoose = require('mongoose');
const options = require('../options');

/**
 * Represents a shard hash for a file pointer
 * @constructor
 */
var HashSchema = new mongoose.Schema({
  _id: { // hash
    type: String,
    required: true
  },
  file: {
    type: String,
    ref: 'File'
  },
  index: {
    type: Number,
    required: true
  }
});

options.apply(HashSchema, {
  read: 'secondaryPreferred'
});

HashSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

HashSchema.virtual('hash').get(function() {
  return this._id;
});

HashSchema.statics.create = function(file, hash, index, callback) {
  var Hash = this;
  var hashdoc = new Hash({
    file: file._id,
    index: index,
    _id: hash
  });

  Hash.findOneAndUpdate({
    _id: hash
  }, hashdoc, {
    upsert: true,
    new: true
  }, function(err, result) {
    if (err) {
      return  callback(err);
    }

    callback(null, result);
  });
};

module.exports = function(connection) {
  return connection.model('Hash', HashSchema);
};
