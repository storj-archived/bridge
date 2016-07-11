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
  locked: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 0
  },
  shards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pointer'
  }]
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
 * Locks a frame
 * @param {Function} callback
 */
Frame.methods.lock = function(callback) {
  this.locked = true;

  this.save(callback);
};

/**
 * Unlocks a frame
 * @param {Function} callback
 */
Frame.methods.unlock = function(callback) {
  this.locked = false;

  this.save(callback);
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
