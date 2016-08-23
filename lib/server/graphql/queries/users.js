'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const UserType = require('../types/user');

const usersQuery = {
  type: new graphql.GraphQLList(UserType),
  resolve: function(_, args) {
    const models = graphqlService.models;
    
    return new Promise((resolve, reject) => {
      models.User.find((err, users) => {
        if (err) {
          reject(err);
        } else {
          resolve(users);
        }
      });
    });
  }
};

module.exports = usersQuery;
