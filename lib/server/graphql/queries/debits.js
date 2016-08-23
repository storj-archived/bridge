'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const DebitType = require('../types/debit');

const DebitsQuery = {
  type: new graphql.GraphQLList(DebitType),
  resolve: function(_, args) {
    const models = graphqlService.models;

    graphqlService.currentUser
        .then((user) => {
          return models.Debit.find({user: user._id})
              .then((debits) => {
                console.log('debits: %j', debits);
                return debits;
              });
        });
  }
};

module.exports = DebitsQuery;
