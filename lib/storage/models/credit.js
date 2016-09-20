'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const constants = require('../../constants');
const CREDIT_TYPES = constants.CREDIT_TYPES;
const PAYMENT_PROCESSORS = constants.PAYMENT_PROCESSORS;

// TODO: standardize property names to lowerCamelCase

const Credit = new mongoose.Schema({
  paid_amount: {
    type: mongoose.Schema.Types.Currency,
    required: true,
    default: 0
  },
  invoiced_amount: {
    type: mongoose.Schema.Types.Currency,
    required: true,
    default: 0
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    required: true,
    ref: 'User'
  },
  promo_code: {
    type: String,
    default: null
  },
  promo_amount: {
    type: mongoose.Schema.Types.Currency,
    default: 0
  },
  paid: {
    type: Boolean,
    default: false
  },
  created: {
    type: Date,
    default: Date.now
  },
  payment_processor: {
    type: String,
    enum: Object.keys(PAYMENT_PROCESSORS).map((key) => (PAYMENT_PROCESSORS[key])),
    default: null,
  },
  type: {
    type: String,
    enum: Object.keys(CREDIT_TYPES).map((key) => (CREDIT_TYPES[key])),
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
});

// TODO: Hand test this validaton
Credit.pre('save', (next) => {
  try {
    if(this.promo_amount > 0){
      console.assert(typeof this.promo_code !== 'null')
      console.assert(this.paid_amount === 0)
      console.assert(this.invoiced_amount === 0);
    }
  } catch(err) {
    return next(new Error("Cannot save credit: ", err));
  }

  return next();
})

Credit.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

module.exports = function(connection) {
  return connection.model('Credit', Credit);
};
