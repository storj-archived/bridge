'use strict';

const graphql = require('graphql');

const CreditType = new graphql.GraphQLObjectType({
  name: 'Credit',
  fields: {
    id: {type: graphql.GraphQLString},
    paid_amount: {type: graphql.GraphQLInt},
    created: {type: graphql.GraphQLString},
    type: {type: graphql.GraphQLString}
  }
});

module.exports = CreditType;
