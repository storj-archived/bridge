/**
 * @class metadisk/models/contact
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Represents a known contact
 * @constructor
 */
var ContactSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true
  },
  port: {
    type: Number,
    required: true
  },
  nodeID: {
    type: String,
    required: true,
    unique: true
  },
  lastSeen: {
    type: Date,
    required: true
  }
});

ContactSchema.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

/**
 * Returns the URI representation for the contact
 */
ContactSchema.methods.toString = function() {
  return ['storj://', this.address, ':', this.port, '/', this.nodeID].join('');
};

/**
 * Creates a contact
 * @param {kad.contacts.AddressPortContact} contact
 * @param {Function} callback
 */
ContactSchema.statics.record = function(contactInfo, callback) {
  let Contact = this;
  let contact = new Contact(contactInfo);
  let done = callback || function() {};

  Contact.findOne({ nodeID: contact.nodeID }, function(err, result) {
    if (err) {
      return done(err);
    }

    if (!result) {
      return contact.save(done);
    }

    result.address = contact.address;
    result.port = contact.port;
    result.lastSeen = contact.lastSeen;

    result.save(done);
  });
};

/**
 * Returns the last N recently seen contacts
 * @param {kad.contacts.AddressPortContact} contact
 * @param {Function} callback
 */
ContactSchema.statics.recall = function(num, callback) {
  this.find({}).limit(num).sort({ lastSeen: -1 }).exec(callback);
};

module.exports = function(connection) {
  return connection.model('Contact', ContactSchema);
};
