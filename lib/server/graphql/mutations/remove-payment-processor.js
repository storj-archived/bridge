'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorAdapters = require('../payment-processor-adapters');

const removePaymentProcessor = {
  type: paymentProcessorType,
  resolve: function(_, args) {
    graphqlService.currentUser
        .then((user) => {
          const defaultPaymentProcessor = user.paymentProcessors
              .find((processor) => (!!processor.default));

          if (!defaultPaymentProcessor) {
            return null;
          }

          const options = {
            name: defaultPaymentProcessor.name,
            user: user
          };

          return paymentProcessorAdapters[defaultPaymentProcessor.name]
              .remove(options);
        })
        .catch((err) => {
          console.error(err);
          throw err;
        })
    ;
  }
};

module.exports = removePaymentProcessor;
