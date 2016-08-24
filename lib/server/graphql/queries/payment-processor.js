'use strict';

const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');

const paymentProcessorQuery = {
  type: paymentProcessorType,
  resolve: function(user, args) {
    return graphqlService.currentUser
        .then((user) => {
          // return user.
          return {
            name: 'stripe',
            defaultCard: {
              merchant: 'visa',
              lastFour: '4242'
            }
          };
        });
  }
};

module.exports = paymentProcessorQuery;
