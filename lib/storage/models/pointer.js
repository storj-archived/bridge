'use strict';

const storj = require('storj-lib');
const assert = require('assert');
const mongoose = require('mongoose');
const SchemaOptions = require('../options');

/**
 * Represents a shard pointer
 * @constructor
 */
var Pointer = new mongoose.Schema({
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
});

Pointer.plugin(SchemaOptions);

Pointer.set('toObject', {
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
Pointer.methods._validate = function() {
  let challenges = this.challenges;
  let tree = this.tree;

  assert(typeof this.index === 'number', 'Invalid index supplied');
  assert(Number.isFinite(this.index), 'Invalid index supplied');
  assert(this.index >= 0, 'Invalid index supplied');
  assert(
    Buffer(storj.utils.rmd160sha256(this.hash), 'hex').length === 20,
    'Invalid RIPEMD-160 SHA-256 hash (hex) supplied'
  );
  assert(typeof this.size === 'number', 'Invalid size supplied');
  assert(Number.isFinite(this.size), 'Invalid size supplied');
  assert(this.size > 0, 'Invalid size supplied');
  assert(Array.isArray(challenges), 'Invalid challenges supplied');
  assert(challenges.length, 'Not enough challenges supplied');
  assert(Array.isArray(tree), 'Invalid tree supplied');
  assert(
    tree.length === storj.utils.getNextPowerOfTwo(challenges.length),
    'Challenges and tree do not match'
  );
};

/**
 * Creates a Pointer
 * @param {Function} callback
 */
Pointer.statics.create = function(shard, callback) {
  let Pointer = this;
  let pointer = new Pointer(shard);

  try {
    pointer._validate();
  } catch (err) {
    return callback(err);
  }

  pointer.save(function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, pointer);
  });
};

module.exports = function(connection) {
  return connection.model('Pointer', Pointer);
};
