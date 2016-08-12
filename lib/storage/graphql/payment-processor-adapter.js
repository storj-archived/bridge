'use strict';

// TODO: pull secret key from env var
// NB: this is not a real secret key so u dudes who think ur clever can suck it!
const stripe = require('stripe')('sk_test_W6L09JRZ1YR4Ua0KuDCDTST3');

const paymentProcessors = {
  stripe: {
    add: (options) => {
      return new Promise((resolve, reject) => {
        stripe.customers.create({
          source: options.data, // token obtained with Stripe.js
          plan: 'gold_member',
          email: options.user
        }, function(err, customer) {
          if (err) {
            return reject(err);
          }

          // interact with models to store shit...
          /*
           * // find user
           * ...
           * 
           * // filter payment processors to match this one if it exists; it probably won't - probably factor this out
           * const userPaymentProcessor = user.paymentProcessors.filter((processor) => (processor.name === 'stripe'))[0]
           * // if a paymentProcessor exists, overwirte? push to `#data`?
           * userPaymentProcessor.data
           * 
           * // TODO: investigate mongoose's `$push` - again, maybe factor this out...
           * user.paymentProcessor.$push({
           *   _id: 'stripe',
           *   data: JSON.stringify(customer)
           * });
           * user.save
           * 
           */

          // TODO: resolve something ?
          resolve(customer);
        });
      });
    }
  },
  braintree: {}
};

const paymentProcessorAdapter = (name) => {
  return paymentProcessors[name];
};

module.exports = paymentProcessorAdapter;
