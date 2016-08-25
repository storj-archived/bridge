'use strict';

const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorAdapters = require('../payment-processor-adapters');

const paymentProcessorQuery = {
  type: paymentProcessorType,
  resolve: function(user, args) {
    return graphqlService.currentUser
        .then((user) => {
          const defaultPaymentProcessor = user.paymentProcessors
              .find((processor) => (!!processor.default));

          if (!defaultPaymentProcessor) {
            return null;
          }

          const name = defaultPaymentProcessor.name;
          // TODO: refactor with stripe adapter:130
          const defaultCard = paymentProcessorAdapters[name]
              .defaultPaymentMethod({user: user});

          return {
            name: name,
            defaultCard: defaultCard
          };
        });
  }
};

module.exports = paymentProcessorQuery;
