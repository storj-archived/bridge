'use strict';

const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorAdapters = require('../payment-processor-adapters');

const paymentProcessorQuery = {
  type: paymentProcessorType,
  resolve: function(user, args) {
    return graphqlService.currentUser
        .then((user) => {
          return user.defaultPaymentProcessor;
        });
  }
};

module.exports = paymentProcessorQuery;
