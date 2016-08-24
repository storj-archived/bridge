'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const DebitType = require('../types/debit');

const DebitsQuery = {
  type: new graphql.GraphQLList(DebitType),
  resolve: function(_, args) {
    const models = graphqlService.models;

    return graphqlService.currentUser
        .then((user) => {
          return models.Debit.find({user: user._id});
        });
  }
};

module.exports = DebitsQuery;
