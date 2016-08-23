'use strict';

const graphql = require('graphql');
const models = require('../index').models;
const UserType = require('../types/user');

const userQuery = {
  type: UserType,
  args: {
    id: {type: graphql.GraphQLString}
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      models.User.findOne({_id: args.id}, (err, user) => {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      });
    });
  }
};

module.exports = userQuery;
