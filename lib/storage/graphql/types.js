'use strict';

const mongoose = require('mongoose');
const User = require('../models/user')(mongoose.createConnection('mongodb://localhost:27017/__storj-bridge-develop'));
const Promise = require('bluebird');
const graphql = require('graphql');

var UserType = new graphql.GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: graphql.GraphQLString },
    activator: { type: graphql.GraphQLString },
    activated: { type: graphql.GraphQLBoolean },
    created: { type: graphql.GraphQLString },
    hashpass: { type: graphql.GraphQLString }
  }
});

var schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
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
          id: { type: graphql.GraphQLString }
        },
        resolve: function(_, args) {
          return new Promise((resolve, reject) => {
            User.findOne({_id: args.id}, (err, user) => {
              if(err){
                reject(err);
              }else{
                resolve(user);
              }
            });
          });
        }
      }
    }
  })
})

module.exports = schema;
