'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const CreditType = require('../types/credit');

const CreditsQuery = {
  type: new graphql.GraphQLList(CreditType),
  resolve: function(_, args) {
    const models = graphqlService.models;

    graphqlService.currentUser
        .then((user) => {
          return models.Credit.find({user: user})
              .then((credits) => {
                console.log('credits: %j', credits);
                return credits;
              });
        });
  }
};

module.exports = CreditsQuery;
