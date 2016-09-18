'use strict';

const storj = require('storj');
const mongoose = require('mongoose');
const SchemaOptions = require('../options');

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
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  pubkeys: [{
    type: String,
    ref: 'PublicKey'
  }],
  user: {
    type: mongoose.SchemaTypes.Email,
    ref: 'User'
  },
  name: {
    type: String,
    default: 'New Bucket'
  },
  created: {
    type: Date,
    default: Date.now
  }
});

Bucket.plugin(SchemaOptions);

Bucket.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;

    ret.id = doc._id;
  }
});

/**
 * Creates a Bucket
 * @param {storage.models.User} user
 * @param {Object} data
 * @param {Function} callback
 */
Bucket.statics.create = function(user, data, callback) {
  let Bucket = this;
  let bucket = new Bucket({
    storage: data.storage,
    transfer: data.transfer,
    status: 'Active',
    name: data.name,
    pubkeys: data.pubkeys,
    user: user._id
  });

  var bucketId = storj.utils.calculateBucketId( bucket.user, bucket.name );
  bucket._id = mongoose.Types.ObjectId(bucketId);

  bucket.save(function(err) {
    if (err) {
      return callback(err);
    }

    Bucket.findOne({ _id: bucket._id }, function(err, bucket) {
      if (err) {
        return callback(err);
      }

      if (!bucket) {
        return callback(new Error('Failed to load created bucket'));
      }

      callback(null, bucket);
    });
  });
};

module.exports = function(connection) {
  return connection.model('Bucket', Bucket);
};
