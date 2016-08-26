'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorAdapters = require('../payment-processor-adapters');

const removePaymentProcessor = {
  type: paymentProcessorType,
  resolve: function(_, args) {
    return graphqlService.currentUser
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
              .remove(options)
              .then(() => {
                return {status: 'success'};
              })
              .catch((err) => {
                return {status: err};
              })
          ;
        })
        .catch((err) => {
          console.error(err);
          return {error: err};
        })
    ;
  }
};

module.exports = removePaymentProcessor;
