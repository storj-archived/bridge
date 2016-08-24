'use strict';

const graphql = require('graphql');
const creditsQuery = require('./credits');
const debitsQuery = require('./debits');
const paymentProcessorQuery = require('./payment-processor');

const rootQuery = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: {
    credits: creditsQuery,
    debits: debitsQuery,
    paymentProcessor: paymentProcessorQuery
  }
});

module.exports = rootQuery;
