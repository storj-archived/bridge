'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');

const Debit = new mongoose.Schema({
  amount: {
    type: mongoose.Types.Currency,
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

Debit.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

module.exports = function(connection) {
  return connection.model('Debit', Debit);
};
