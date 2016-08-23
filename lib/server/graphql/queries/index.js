'use strict';

const graphql = require('graphql');
const usersQuery = require('./users');
const userQuery = require('./user');

const rootQuery = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: {
    users: usersQuery,
    user: userQuery
  }
});

module.exports = rootQuery;

// const rootQueryFactory = (boundModels) => {
//   models = boundModels;
//   return rootQuery;
// };
//
// module.exports = rootQueryFactory;
