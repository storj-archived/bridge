'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');

const removePaymentProcessor = {
  type: paymentProcessorType,
  resolve: function(_, args) {
    return graphqlService.currentUser
        .then((user) => {
          return user.defaultPaymentProcessor.delete();
        })
        .catch((err) => {
          console.error(err);
          return {error: new Error(err)};
        })
    ;
  }
};

module.exports = removePaymentProcessor;
