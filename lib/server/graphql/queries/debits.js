'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const DebitType = require('../types/debit');
const moment = require('moment');

const DebitsQuery = {
  type: new graphql.GraphQLList(DebitType),
  args: {
    startDate: {type: graphql.GraphQLString},
    endDate: {type: graphql.GraphQLString}
  },
  resolve: function(_, args) {
    const models = graphqlService.models;
    const params = {};

    if (args.startDate && args.endDate) {
      params.created = {
        $gte: moment(parseInt(args.startDate, 0)),
        $lte: moment(parseInt(args.endDate, 0))
      };
    }

    return graphqlService.currentUser
        .then((user) => {
          params.user = user._id;

          return models.Debit.find(params);
        })
        ;
  }
};

module.exports = DebitsQuery;
