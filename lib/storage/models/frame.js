'use strict';

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
    audits: {
      root: {
        type: String,
        required: true
      },
      depth: {
        type: Number,
        required: true
      },
      challenges: [String]
    }
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
 * Adds a shard item to the frame
 * @param {Object} shard
 * @param {Function} callback
 */
Frame.methods.addShard = function(shard, callback) {
  // TODO: Implement me
  callback(new Error('Not implemented'));
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
