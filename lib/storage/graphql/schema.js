'use strict';

const graphql = require('graphql');
const paymentProcessorAdapter = require('./payment-processor-adapter');
const PAYMENT_PROCESSORS = require('../../constants').PAYMENT_PROCESSORS;

module.exports = function(models, req) {
  const User = models.User;
  const Credit = models.Credit;
  const Debit = models.Debit;

  const CreditType = new graphql.GraphQLObjectType({
    name: 'Credit',
    fields: {
      id: {type: graphql.GraphQLString},
      amount: {type: graphql.GraphQLInt},
      created: {type: graphql.GraphQLString}
    }
  });

  const DebitType = new graphql.GraphQLObjectType({
    name: 'Debit',
    fields: {
      id: {type: graphql.GraphQLString},
      amount: {type: graphql.GraphQLInt},
      created: {type: graphql.GraphQLString}
    }
  });

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
          console.log("USER IS: ", user);
          return new Promise((resolve, reject) => {
            Credit.find({user_id: user._id}, (err, result) => {
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
            Debit.find({user_id: user._id}, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
        }
      }
    }
  });

  const paymentProcessorEnum = new graphql.GraphQLEnumType({
    name: 'PaymentProcessorEnum',
    values: Object.keys(PAYMENT_PROCESSORS).reduce((values, processorKey) => {
      values[processorKey] = {value: PAYMENT_PROCESSORS[processorKey]};
      return values;
    }, {})
  });

  const paymentProcessorType = new graphql.GraphQLObjectType({
    name: 'PaymentProcessor',
    fields: {
      name: {type: paymentProcessorEnum},
      data: {type: graphql.GraphQLString}
    }
  });

  const addPaymentProcessor = {
    type: paymentProcessorType,
    args: {
      name: {
        type: paymentProcessorEnum
      },
      data: {
        type: graphql.GraphQLString
      }
    },
    resolve: function(_, args) {
      console.log('ARGS: ', args);
      return new Promise((resolve, reject) => {
        const publicKeyHeader = req.header('x-pubkey');
        if (!publicKeyHeader) {
          reject('Request not authenticated via ECDSA.');
        }

        return models.PublicKey.findOne({
          _id: publicKeyHeader
        })
            .catch((err) => (err))
            .then((publicKey)=> {
              return paymentProcessorAdapter(args.name).add({
                data: JSON.parse(args.data),
                user: publicKey.user
              });
            })
            .then((data) => {
              // resolve here with something...
            })
            ;
      });
    }
  };

  const usersQuery = {
    type: new graphql.GraphQLList(UserType),
    resolve: function(_, args) {
      return new Promise((resolve, reject) => {
        User.find((err, users) => {
          if (err) {
            reject(err);
          } else {
            resolve(users);
          }
        });
      });
    }
  };

  const userQuery = {
    type: UserType,
    args: {
      id: {type: graphql.GraphQLString}
    },
    resolve: function(_, args) {
      return new Promise((resolve, reject) => {
        User.findOne({_id: args.id}, (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        });
      });
    }
  };

  const rootQuery = new graphql.GraphQLObjectType({
    name: 'Root Query',
    fields: {
      users: usersQuery,
      user: userQuery
    }
  });

  const rootMutation = new graphql.GraphQLObjectType({
    name: 'Root Mutation',
    fields: {
      addPaymentProcessor: addPaymentProcessor
    }
  });

  const schema = new graphql.GraphQLSchema({
    query: rootQuery,
    mutation: rootMutation
  });

  return schema;
};
