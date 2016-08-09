'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');

const Credit = new mongoose.Schema({
  amount: {
    type: mongoose.Types.Currency,
    required: true
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    required: true,
    ref: 'User'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = function(connection) {
  return connection.model('Credit', Credit);
};
