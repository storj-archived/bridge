'use strict';

const constants = require('../../constants');
const STRIPE = constants.PAYMENT_PROCESSORS.STRIPE;
const BRAINTREE = constants.PAYMENT_PROCESSORS.BRAINTREE;

const stripeAdapter = require('./stripe');
const braintreeAdapter = require('./braintree');

const adapterFactories = {};
adapterFactories[STRIPE] = stripeAdapter;
adapterFactories[BRAINTREE] = braintreeAdapter;

/**
 * initFactories - iterate over adapterFactories and pass `models` to them
 * @param models {Object}
 * @return {Object}: object of initialized payment processor adapters
 */
const initFactories = (models) => {
  return Object.keys(adapterFactories).reduce((adapters, name) => {
    adapters[name] = adapterFactories[name](models);
    return adapters;
  }, {});
};

module.exports = initFactories;
