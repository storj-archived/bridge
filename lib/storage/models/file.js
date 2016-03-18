'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');

/**
 * Represents a file pointer
 * @constructor
 */
var FileSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    min: 0,
    default: 0
  }
});

FileSchema.virtual('hash').get(function() {
  return this._id;
});

FileSchema.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

FileSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
  }
});

module.exports = function(connection) {
  return connection.model('File', FileSchema);
};
