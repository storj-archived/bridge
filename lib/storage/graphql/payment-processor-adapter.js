'use strict';

// TODO: pull secret key from env var
// NB: this is not a real secret key so u dudes who think ur clever can suck it!
const stripe = require('stripe')('sk_test_W6L09JRZ1YR4Ua0KuDCDTST3');
let models;
const STRIPE = require('../../constants').PAYMENT_PROCESSORS.STRIPE;
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

          models.User.findOne({ _id: options.user })
            .then((user) => {
              console.log("models.User.find(): ", user);
              const userPaymentProcessor = user.paymentProcessor.filter(
                (processor) => (processor.name === STRIPE)
              )[0];

              console.log("userPaymentProcessor: %j", userPaymentProcessor);

              if (typeof(userPaymentProcessor) === 'undefined') {
                user.paymentProcessor.push([{ _id: STRIPE, data: customer }]);
                console.log("user payment processors after push: %j", user.paymentProcessor);
              } else {
                userPaymentProcessor.data = [customer];
              }

              return user.save();
            })
            .catch((err) => {
              console.log("Error saving user payment processor: ", err);
            })

        });
      });
    }
  },
  braintree: {}
};

const paymentProcessorAdapter = (name) => {
  return paymentProcessors[name];
};

const paymentProcessorAdapterFactory = (incomingModels) => {
  models = incomingModels;
  return paymentProcessorAdapter;
}

module.exports = paymentProcessorAdapterFactory;
