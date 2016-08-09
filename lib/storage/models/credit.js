'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const storage =

const Credit = new mongoose.Schema({
  amount: {
    type: mongoose.Schema.Types.Currency,
    required: true
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    required: true,
    ref: 'User'
  },
  created: {
    type: Date,
    default: Date.now
  }
});

Credit.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

module.exports = function(connection) {
  return connection.model('Credit', Credit);
};
