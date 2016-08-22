'use strict';

const graphql = require('graphql');
const PAYMENT_PROCESSORS = require('../../constants').PAYMENT_PROCESSORS;
const paymentProcessorAdaptersFactory = require('../payment-processor-adapters');

module.exports = function(models, req) {
  const paymentProcessorAdapters = paymentProcessorAdaptersFactory(models);
  const User = models.User;
  const Credit = models.Credit;
  const Debit = models.Debit;

  const CreditType = new graphql.GraphQLObjectType({
    name: 'Credit',
    fields: {
      id: {type: graphql.GraphQLString},
      amount: {type: graphql.GraphQLInt},
      created: {type: graphql.GraphQLString},
      type: {type: graphql.GraphQLString}
    }
  });

  const DebitType = new graphql.GraphQLObjectType({
    name: 'Debit',
    fields: {
      id: {type: graphql.GraphQLString},
      amount: {type: graphql.GraphQLInt},
      created: {type: graphql.GraphQLString},
      type: {type: graphql.GraphQLString}
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
      data: {type: graphql.GraphQLString},
      status: {type: graphql.GraphQLString},
      message: {type: graphql.GraphQLString}
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
      const publicKeyHeader = req.header('x-pubkey');
      if (!publicKeyHeader) {
        return Promise.reject({
          status: 'error',
          message: 'Request not authenticated via ECDSA.'
        });
      }

      return models.PublicKey.findOne({_id: publicKeyHeader})
          .then((publicKey)=> {
            return models.User.findOne({_id: publicKey.user})
                .then((user) => {

                  return paymentProcessorAdapters[args.name].add({
                    data: JSON.parse(args.data),
                    user: user
                  });
                });
          }).catch((err) => {
            throw err;
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

  const paymentProcessorQuery = {
    type: paymentProcessorType,
    args: {
      id: {type: graphql.GraphQLString}
    },
    resolve: function(_, args) {
      return new Promise((resolve, reject) => {
        User.findOne({_id: args.id })
          .select('paymentProcessors')
          .exec()
          .then((data) => {
            resolve(data)
          })
          .catch((err) => {
            reject(err);
          })
      })
    }
  }

  const rootQuery = new graphql.GraphQLObjectType({
    name: 'Query',
    fields: {
      users: usersQuery,
      user: userQuery,
      card: paymentProcessorQuery
    }
  });

  const rootMutation = new graphql.GraphQLObjectType({
    name: 'Mutation',
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
