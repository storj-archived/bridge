'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const CreditType = require('../types/credit');

const CreditsQuery = {
  type: new graphql.GraphQLList(CreditType),
  resolve: function(_, args) {
    const models = graphqlService.models;

    return graphqlService.currentUser
        .then((user) => {
          return models.Credit.find({user: user._id});
        });
  }
};

module.exports = CreditsQuery;
