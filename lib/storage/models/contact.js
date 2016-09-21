'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');

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
  },
  protocol: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  }
});

ContactSchema.plugin(SchemaOptions);

ContactSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    delete ret.id;
  }
});

ContactSchema.virtual('nodeID').get(function() {
  return this._id;
});

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
    protocol: contactInfo.protocol,
    userAgent: contactInfo.userAgent,
    address: contactInfo.address,
    port: contactInfo.port,
    lastSeen: contactInfo.lastSeen
  });

  Contact.findOneAndUpdate({ _id: contactInfo.nodeID }, contact, {
    upsert: true,
    new: true
  }, done);
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
