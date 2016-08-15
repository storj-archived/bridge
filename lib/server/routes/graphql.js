'use strict';

const Router = require('./index');
const errors = require('../errors');
const inherits = require('util').inherits;
const graphqlHTTP = require('express-graphql');
const graphql = require('graphql');
const authenticate = require('../middleware').authenticate;
const schema = require('../../storage/graphql/schema');

function GraphQLRouter(config, storage, network, mailer) {
  if (!(this instanceof GraphQLRouter)) {
    return new GraphQLRouter(config, network, storage, mailer);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
}

/**
 * Set up defaults and schema
 */
inherits(GraphQLRouter, Router);

const options = {
  mutation: true,
  allowMongoIDMutation: false
};


GraphQLRouter.DEFAULTS = {
  skip: 0,
  limit: 30
};

GraphQLRouter.prototype._definitions = function() {
  return [
    ['use', '/graphql', this._verify, (req, res, next) => {
      graphqlHTTP(
          {schema: schema(this.storage.models, req)},
          options
      )(req, res, next);
    }]
  ];
};

module.exports = GraphQLRouter;
