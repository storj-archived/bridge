'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const elliptic = require('elliptic');
const ecdsa = new elliptic.ec(elliptic.curves.secp256k1);

/**
 * Represents a public key
 * @constructor
 */
var PublicKey = new mongoose.Schema({
  _id: { // key
    type: String,
    required: true
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    ref: 'User'
  }
});

PublicKey.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

PublicKey.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

PublicKey.virtual('key').get(function() {
  return this._id;
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
    _id: pubkey
  });

  var kp;

  try {
    kp = ecdsa.keyFromPublic(pubkey, 'hex');
  } catch (err) {
    return callback(new Error('Invalid public key supplied: ' + err.message));
  }

  PublicKey.findOne({ _id: pubkey }, function(err, pubkey) {
    if (pubkey) {
      return callback(new Error('Public key is already registered'));
    }

    publicKey.save(function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, publicKey);
    });
  });
};

module.exports = function(connection) {
  return connection.model('PublicKey', PublicKey);
};
