'use strict';

const graphql = require('graphql');
const paymentProcessorEnum = require('./payment-processor-enum');

const paymentProcessorType = new graphql.GraphQLObjectType({
  name: 'PaymentProcessor',
  fields: {
    name: {type: paymentProcessorEnum},
    data: {type: graphql.GraphQLString},
    status: {type: graphql.GraphQLString},
    message: {type: graphql.GraphQLString}
  }
});

module.exports = paymentProcessorType;
