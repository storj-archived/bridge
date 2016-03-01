/**
 * @class metadisk/models/user
 */

'use strict';

const activator = require('hat').rack(256);
const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Represents a user
 * @constructor
 */
var User = new mongoose.Schema({
  _id: { // email
    type: mongoose.SchemaTypes.Email,
    required: true
  },
  hashpass: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  },
  activator: {
    type: mongoose.Schema.Types.Mixed,
    default: activator
  },
  activated: {
    type: Boolean,
    default: false
  },
  // incremented on API request
  __nonce: {
    type: Number,
    default: 0
  }
}, require('../options'));

User.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    delete ret.__nonce;
    delete ret.hashpass;
    delete ret.activator;
  }
});

User.virtual('email').get(function() {
  return this._id;
});

/**
 * Activates a user
 * @param {Function} callback
 */
User.methods.activate = function(callback) {
  this.activated = true;
  this.activator = null;
  this.save(callback);
};

/**
 * Deactivates a user
 * @param {Function} callback
 */
User.methods.deactivate = function(callback) {
  this.activated = false;
  this.activator = activator();
  this.save(callback);
};

/**
 * Creates a User
 * @param {String} email
 * @param {String} password (hashed on client)
 * @param {Function} callback
 */
User.statics.create = function(email, passwd, callback) {
  let User = this;
  let user = new User({
    _id: email,
    hashpass: crypto.createHash('sha256').update(passwd).digest('hex')
  });

  User.findOne({ _id: email }, function(err, result) {
    if (err) {
      return callback(err);
    }

    if (result) {
      let error = new Error('Email is already registered'); error.code = 400;
      return callback(error);
    }

    user.save(function(err) {
      if (err) {
        if (err.code === 11000) {
          return callback(new Error('Email is already registered'));
        }

        return callback(err);
      }

      callback(null, user);
    });
  });
};

/**
 * Lookup a User
 * @param {String} email
 * @param {String} password (hashed on client)
 * @param {Function} callback
 */
User.statics.lookup = function(email, passwd, callback) {
  let User = this;

  User.findOne({
    _id: email,
    hashpass: crypto.createHash('sha256').update(passwd).digest('hex')
  }, function(err, user) {
    if (err) {
      return callback(err);
    }

    if (!user) {
      return callback(new Error('Invalid email or password'));
    }

    callback(null, user);
  });
};

module.exports = function(connection) {
  return connection.model('User', User);
};
