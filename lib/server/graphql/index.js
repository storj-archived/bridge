'use strict';

/**
 * Singleton object for graphql things.
 */

const graphql = require('graphql');

let _schema;
let _models;
let _lastRequest;

module.exports = {
  bindSchema: function(boundModels) {
    _models = boundModels;

    //NB: must load deps here so this export event loop can finish first (circular deps)
    //TODO: fix this?
    const rootQuery = require('./queries');
    const rootMutation = require('./mutations');
    _schema = new graphql.GraphQLSchema({
      query: rootQuery,
      mutation: rootMutation
    });
    _schema.middleware = (req, res, next) => {
      _lastRequest = req;
      next();
    };

    return this.schema;
  },
  get schema() {
    if (!_schema) {
      throw new Error('graphql schema hasn\'t been initialized yet!');
    }

    return _schema;
  },
  get models() {
    if (!_models) {
      throw new Error('graphql schema hasn\'t been initialized with models!');
    }

    return _models;
  },
  get lastRequest() {
    if (!_models) {
      throw new Error('graphql schema hasn\'t processed any requests!');
    }

    return _lastRequest;
  }
};
