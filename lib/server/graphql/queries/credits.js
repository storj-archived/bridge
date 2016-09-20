'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const CreditType = require('../types/credit');
const moment = require('moment');

const CreditsQuery = {
  type: new graphql.GraphQLList(CreditType),
  args: {
    startDate: {type: graphql.GraphQLString},
    endDate: {type: graphql.GraphQLString}
  },
  resolve: function(_, args) {
    const models = graphqlService.models;
    const params = {};

    if (args.startDate && args.endDate) {
      params.created = {
        $gte: moment(parseInt(args.startDate, 0)).add('1', 'month'),
        $lte: moment(parseInt(args.endDate, 0)).add('1', 'month')
      };
    }

    return graphqlService.currentUser
        .then((user) => {
          params.user = user._id;

          return models.Credit.find(params);
        })
        ;
  }
};

module.exports = CreditsQuery;
