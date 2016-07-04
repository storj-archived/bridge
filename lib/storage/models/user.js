'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const SchemaOptions = require('../options');

const utils = require('../utils');

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
  pendingHashPass: {
    type: String,
    default: null
  },
  salt: {
    type: String,
    default: null,
    required: true,
    set: utils.hexToBase64,
    get: utils.base64ToHex
  },
  pendingSalt: {
    type: String,
    default: null,
    set: utils.hexToBase64,
    get: utils.base64ToHex
  },
  created: {
    type: Date,
    default: Date.now,
    required: true
  },
  activator: {
    type: String,
    default: utils.hexToBase64(utils.activator()),
    set: utils.hexToBase64,
    get: utils.base64ToHex
  },
  deactivator: {
    type: String,
    default: null,
    set: utils.hexToBase64,
    get: utils.base64ToHex
  },
  resetter: {
    type: String,
    default: null,
    set: utils.hexToBase64,
    get: utils.base64ToHex
  },
  activated: {
    type: Boolean,
    default: false,
    required: true
  }
});

User.plugin(SchemaOptions);

User.index({resetter: 1});

User.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    delete ret.hashpass;
    delete ret.activator;
    delete ret.deactivator;
    delete ret.resetter;
    delete ret.pendingHashPass;
    delete ret.salt;
    delete ret.pendingSalt;
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
  this.activator = utils.activator();
  this.save(callback);
};

/**
 * Creates a User
 * @param {String} email
 * @param {String} password (hashed on client)
 * @param {Function} callback
 */
User.statics.create = function(email, passwd, callback) {
  const User = this;
  const newSalt = utils.salt();
  let user = new User({
    _id: email,
    hashpass: crypto.createHash('sha256').update(newSalt + passwd).digest('hex'),
    salt: newSalt
  });

  // Check to make sure the password is already SHA-256 (or at least is the
  // correct number of bits).
  if (Buffer(passwd, 'hex').length * 8 !== 256) {
    return callback(new Error('Password must be hex encoded SHA-256 hash'));
  }

  User.findOne({_id: email}, function(err, result) {
    if (err) {
      return callback(err);
    }

    if (result) {
      return callback(new Error('Email is already registered'));
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
  const User = this;

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
