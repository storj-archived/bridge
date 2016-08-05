const mongoose = require('mongoose');
const User = require('../models/user')(mongoose.createConnection('mongodb://localhost:27017/__storj-bridge-develop'));
const Promise = require('bluebird');
const graphql = require('graphql');

var userType = new graphql.GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: graphql.GraphQLString },
    name: { type: graphql.GraphQLString },
  }
});

var schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: userType,
        args: {
          id: { type: graphql.GraphQLString }
        },
        resolve: function(placeholder, args) {
          return new Promise((resolve, reject) => {
            User.find((err, users) => {
              if(err){
                reject(err);
              }else{
                resolve(users);
              }
            })
          })
        }
      }
    }
  })
})

module.exports = schema;
