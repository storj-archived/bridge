'use strict';

const graphql = require('graphql');

const PaymentCardType = new graphql.GraphQLObjectType({
  name: 'PaymentCard',
  fields: {
    merchant: {type: graphql.GraphQLString},
    lastFour: {type: graphql.GraphQLString}
  }
});

module.exports = PaymentCardType;
