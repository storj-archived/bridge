'use strict';

const storj = require('storj');
const assert = require('assert');
const mongoose = require('mongoose');
const SchemaOptions = require('../options');

/**
 * Represents a file staging frame
 * @constructor
 */
var Frame = new mongoose.Schema({
  created: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    ref: 'User'
  },
  shards: [{
    index: {
      type: Number,
      required: true
    },
    hash: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    tree: [{
      type: String
    }],
    challenges: [{
      type: String
    }]
  }]
});

Frame.virtual('size').get(function() {
  let size = 0;

  this.shards.forEach(function(shard) {
    size += shard.size;
  });

  return size;
});

Frame.plugin(SchemaOptions);

Frame.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;

    ret.id = doc._id;
  }
});

/**
 * Validates the provided shard data
 * @param {Object} shard
 * @private
 */
Frame.methods._validateShardData = function(shard) {
  let challenges = shard.challenges;
  let tree = shard.tree;

  assert(typeof shard.index === 'number', 'Invalid index supplied');
  assert(Number.isFinite(shard.index), 'Invalid index supplied');
  assert(shard.index >= 0, 'Invalid index supplied');
  assert(
    Buffer(storj.utils.rmd160sha256(shard.hash), 'hex').length === 20,
    'Invalid RIPEMD-160 SHA-256 hash (hex) supplied'
  );
  assert(typeof shard.size === 'number', 'Invalid size supplied');
  assert(Number.isFinite(shard.size), 'Invalid size supplied');
  assert(shard.size > 0, 'Invalid size supplied');
  assert(Array.isArray(challenges), 'Invalid challenges supplied');
  assert(challenges.length, 'Not enough challenges supplied');
  assert(Array.isArray(tree), 'Invalid tree supplied');
  assert(
    tree.length === storj.utils.getNextPowerOfTwo(challenges.length),
    'Challenges and tree do not match'
  );
};

/**
 * Adds a shard item to the frame
 * @param {Object} shard
 * @param {Function} callback
 */
Frame.methods.addShard = function(shard, callback) {
  try {
    this._validateShardData(shard);
  } catch (err) {
    return callback(err);
  }

  this.shards.push(shard);
};

/**
 * Creates a Frame
 * @param {storage.models.User} user
 * @param {Function} callback
 */
Frame.statics.create = function(user, callback) {
  let Frame = this;
  let frame = new Frame({ user: user._id });

  frame.save(function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, frame);
  });
};

module.exports = function(connection) {
  return connection.model('Frame', Frame);
};
