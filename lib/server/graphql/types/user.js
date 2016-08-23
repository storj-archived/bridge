'use strict';

const graphql = require('graphql');
const models = require('../index').models;
const DebitType = require('./debit');
const CreditType = require('./credit');
const paymentProcessorQuery = require('../queries/payment-processor');


const UserType = new graphql.GraphQLObjectType({
  name: 'User',
  fields: {
    id: {type: graphql.GraphQLString},
    activator: {type: graphql.GraphQLString},
    activated: {type: graphql.GraphQLBoolean},
    created: {type: graphql.GraphQLString},
    hashpass: {type: graphql.GraphQLString},
    credits: {
      type: new graphql.GraphQLList(CreditType),
      resolve: (user, args) => {
        return new Promise((resolve, reject) => {
          models.Credit.find({user_id: user._id}, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      }
    },
    debits: {
      type: new graphql.GraphQLList(DebitType),
      resolve: (user, args) => {
        return new Promise((resolve, reject) => {
          models.Debit.find({user_id: user._id}, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      }
    },
    paymentProcessor: paymentProcessorQuery
  }
});

module.exports = UserType;

// const userTypeFactory = (instanceModels) => {
//   models = instanceModels;
//   return UserType;
// };
//
// module.exports = userTypeFactory;
