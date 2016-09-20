'use strict';

const constants = require('../../../constants');
const STRIPE = constants.PAYMENT_PROCESSORS.STRIPE;
const BRAINTREE = constants.PAYMENT_PROCESSORS.BRAINTREE;

const stripeAdapter = require('./stripe');
const braintreeAdapter = require('./braintree');

const adapters = {};
adapters[STRIPE] = stripeAdapter;
adapters[BRAINTREE] = braintreeAdapter;

module.exports = adapters;
