'use strict';

const paymentProcessorType = require('../types/payment-processor');

const paymentProcessorQuery = {
  type: paymentProcessorType,
  resolve: function(user, args) {
    return new Promise((resolve, reject) => {
      resolve({
        name: 'stripe',
        defaultCard: {
          merchant: 'visa',
          lastFour: '4242'
        }
      });
    });
  }
};

module.exports = paymentProcessorQuery;
