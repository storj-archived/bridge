'use strict';

const mongoose = require('mongoose');
const options = require('../options');

/**
 * Represents a known contact
 * @constructor
 */
var ContactSchema = new mongoose.Schema({
  _id: { // nodeID
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  port: {
    type: Number,
    required: true
  },
  lastSeen: {
    type: Date,
    required: true
  }
});

options.apply(ContactSchema);

ContactSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

ContactSchema.virtual('nodeID').get(function() {
  return this._id;
});

/**
 * Returns the URI representation for the contact
 */
ContactSchema.methods.toString = function() {
  var c = this.toObject();

  return ['storj://', c.address, ':', c.port, '/', c.nodeID].join('');
};

/**
 * Creates a contact
 * @param {kad.contacts.AddressPortContact} contact
 * @param {Function} callback
 */
ContactSchema.statics.record = function(contactInfo, callback) {
  let Contact = this;
  let done = callback || function() {};
  let contact = new Contact({
    _id: contactInfo.nodeID,
    address: contactInfo.address,
    port: contactInfo.port,
    lastSeen: contactInfo.lastSeen
  });

  Contact.findOne({ _id: contact.nodeID }, function(err, result) {
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
