/**
 * @class metadisk/models/pubkey
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Represents a public key
 * @constructor
 */
var PublicKey = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  key: {
    type: String,
    required: true
  }
});

PublicKey.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

/**
 * Creates a public key
 * #create
 * @param {storage.models.User} user
 * @param {String} pubkey
 * @param {Function} callback
 */
PublicKey.statics.create = function(user, pubkey, callback) {
  let PublicKey = this;
  let publicKey = new PublicKey({
    user: user._id,
    key: pubkey
  });

  publicKey.save(function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, publicKey);
  });
};

module.exports = function(connection) {
  return connection.model('PublicKey', PublicKey);
};
