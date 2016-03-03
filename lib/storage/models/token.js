/**
 * @class metadisk/models/token
 */

'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const ms = require('ms');
const options = require('../options');

const TOKEN_TTL = ms('5m');

/**
 * Represents a token (for pulling/pushing files)
 * @constructor
 */
var Token = new mongoose.Schema({
  _id: { // token
    type: String,
    required: true
  },
  bucket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bucket',
    required: true
  },
  expires: {
    type: Date,
    default: Date.now,
    required: true
  },
  operation: {
    type: String,
    enum: ['PUSH', 'PULL'],
    required: true
  }
});

options.apply(Token, {
  read: 'secondaryPreferred'
});

Token.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

Token.virtual('token').get(function() {
  return this._id;
});

/**
 * Creates a one time use token for pushing/pulling a file to/from a bucket
 * #create
 * @param {storage.models.Bucket} bucket
 * @param {String} operation - ['PUSH', 'PULL']
 * @param {Function} callback
 */
Token.statics.create = function(bucket, operation, callback) {
  let Token = this;
  let token = new Token({
    bucket: bucket._id,
    _id: Token.generate(),
    expires: Date.now() + TOKEN_TTL,
    operation: operation
  });

  token.save(function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, token);
  });
};

/**
 * Creates a random token by hashing some random bytes and a timestamp
 * #generate
 */
Token.statics.generate = function() {
  var rbytes = crypto.randomBytes(512);
  var tstamp = Buffer(Date.now().toString());
  var source = Buffer.concat([rbytes, tstamp]);

  return crypto.createHash('sha256').update(source).digest('hex');
};

/**
 * Lookup a token by it's string and return it if valid
 * #lookup
 * @param {String} tokenString
 * @param {Function} callback
 */
Token.statics.lookup = function(tokenString, callback) {
  let Token = this;

  Token.findOne({
    _id: tokenString,
    expires: { $gt: Date.now() }
  }, function(err, token) {
    if (err) {
      return callback(err);
    }

    if (!token) {
      callback(new Error('Invalid or expired token'));
    }

    callback(null, token);
  });
};

module.exports = function(connection) {
  return connection.model('Token', Token);
};
