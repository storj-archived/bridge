'use strict';

const graphql = require('graphql');
const addPaymentProcessor = require('./add-payment-processor');

const rootMutation = new graphql.GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addPaymentProcessor: addPaymentProcessor
  }
});

module.exports = rootMutation;
