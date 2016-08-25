'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorEnum = require('../types/payment-processor-enum');
const paymentProcessorAdapters = require('../payment-processor-adapters');

const addPaymentProcessor = {
  type: paymentProcessorType,
  args: {
    name: {
      type: paymentProcessorEnum
    },
    data: {
      type: graphql.GraphQLString
    }
  },
  resolve: function(_, args) {
    graphqlService.currentUser
        .then((user) => {
          return paymentProcessorAdapters[args.name].add({
            data: JSON.parse(args.data),
            user: user
          });
        })
        .catch((err) => {
          console.error(err);
          throw err;
        })
    ;
  }
};

module.exports = addPaymentProcessor;
