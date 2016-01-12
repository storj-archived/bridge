/**
 * @class metadisk/models/user
 */

'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Represents a user
 * @constructor
 */
var User = new mongoose.Schema({
  email: {
    type: mongoose.SchemaTypes.Email,
    required: true,
    unique: true
  },
  hashpass: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  },
  // incremented on API request
  __nonce: {
    type: Number,
    default: 0
  }
});

User.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    delete ret.__nonce;
    delete ret.hashpass;

    ret.id = doc._id;
  }
});

/**
 * Creates a User
 * #create
 * @param {String} email
 * @param {String} password (hashed on client)
 * @param {Function} callback
 */
User.statics.create = function(email, passwd, callback) {
  let User = this;
  let user = new User({
    email: email,
    hashpass: crypto.createHash('sha256').update(passwd).digest('hex')
  });

  user.save(function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, user);
  });
};

/**
 * Lookup a User
 * #lookup
 * @param {String} email
 * @param {String} password (hashed on client)
 * @param {Function} callback
 */
User.statics.lookup = function(email, passwd, callback) {
  let User = this;

  User.findOne({
    email: email,
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
