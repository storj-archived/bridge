'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');

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
  promo_code: {
    type: String,
    required: false,
    default: null
  },
  created: {
    type: Date,
    default: Date.now
  },
  token: {
    type: String,
    default: null
  },
  payment_processor: {
    type: String,
    default: null
  }
});

Credit.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

module.exports = function(connection) {
  return connection.model('Credit', Credit);
};
