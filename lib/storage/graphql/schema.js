'use strict';

const graphql = require('graphql');

module.exports = function(models) {
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
              Credit.find({ user_id: user._id }, (err, result) => {
                if(err) {
                  reject(err)
                } else {
                  resolve(result);
                }
              })
            })
        }
      },
      debits: {
        type: new graphql.GraphQLList(DebitType),
        resolve: (user, args) => {
            return new Promise((resolve, reject) => {
              Debit.find({ user_id: user._id }, (err, result) => {
                if(err) {
                  reject(err)
                } else {
                  resolve(result);
                }
              })
            })
        }
      }
    }
  });

  const rootQuery = new graphql.GraphQLObjectType({
    name: 'Query',
    fields: {
      users: {
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
      },
      user: {
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
      }
    }
  });

  const schema = new graphql.GraphQLSchema({
    query: rootQuery
  });

  return schema;
};
