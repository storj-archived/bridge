'use strict';

const graphql = require('graphql');
const usersQuery = require('./users');
const userQuery = require('./user');
const creditsQuery = require('./credits');
const debitsQuery = require('./debits');
const paymentProcessorQuery = require('./payment-processor');

const rootQuery = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: {
    // users: usersQuery,
    // user: userQuery,
    credits: creditsQuery,
    debits: debitsQuery,
    paymentProcessor: paymentProcessorQuery
  }
});

module.exports = rootQuery;
