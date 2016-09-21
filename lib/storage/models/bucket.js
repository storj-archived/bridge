'use strict';

const crypto = require('crypto');
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

  // reject name if it is valid bucket id
  var re = /[0-9A-Fa-f]{24}/g;
  if(re.test(data.name)){
    return callback(new Error('Name cannot be 24 character hex'));
  }

  // make default name a random hex string
  data.name = data.name !== undefined ? data.name : 'xxxxxxxx'.replace(/x/g, function() {
    var num = Math.floor(Math.random() * 16);
    return num.toString(16);
  });

  let bucket = new Bucket({
    storage: data.storage,
    transfer: data.transfer,
    status: 'Active',
    name: data.name,
    pubkeys: data.pubkeys,
    user: user._id
  });

  // calculate bucket id by taking first 12 bytes of sha256(user id + bucket name)
  var hashInput = user._id + data.name;
  var bucketHash = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');
  bucket._id = mongoose.Types.ObjectId(bucketHash.substring(0, 24));

  bucket.save(function(err) {
    if (err) {
      if (err.message.indexOf('duplicate key') !== -1) {
        return callback(new Error('Name already used by another bucket'));
      }
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
