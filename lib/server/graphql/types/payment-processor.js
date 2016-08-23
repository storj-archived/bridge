'use strict';

const graphql = require('graphql');
const paymentProcessorEnum = require('./payment-processor-enum');

const paymentProcessorType = new graphql.GraphQLObjectType({
  name: 'PaymentProcessor',
  fields: {
    name: {type: paymentProcessorEnum},
    defaultCard: {
      type: new graphql.GraphQLObjectType({
        name: 'PaymentCardType',
        fields: {
          merchant: {type: graphql.GraphQLString},
          lastFour: {type: graphql.GraphQLString}
        }
      })
    }
  }
});

module.exports = paymentProcessorType;
