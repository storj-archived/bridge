'use strict';

const graphql = require('graphql');
const paymentProcessorEnum = require('./payment-processor-enum');
const PaymentCardType = require('../types/payment-card');

const paymentProcessorType = new graphql.GraphQLObjectType({
  name: 'PaymentProcessor',
  fields: {
    id: {type: graphql.GraphQLString},
    name: {type: paymentProcessorEnum},
    //TODO: maybe paymentMethod instead of card?
    defaultCard: {type: PaymentCardType},
    billingDate: {type: graphql.GraphQLInt},
    error: {type: graphql.GraphQLString}
  }
});

module.exports = paymentProcessorType;
