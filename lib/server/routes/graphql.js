'use strict';

const Router = require('./index');
const errors = require('../errors');
const inherits = require('util').inherits;
const graphqlHTTP = require('express-graphql');
const getSchema = require('@risingstack/graffiti-mongoose').getSchema;
const graphql = require('graphql');
const authenticate = require('../middleware').authenticate;

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
}

GraphQLRouter.DEFAULTS = {
  skip: 0,
  limit: 30
};

/**
 * Exposes main GraphQL Endpoint for Maximum Good Time Happy Points
 */
GraphQLRouter.prototype.graphQL = function(req, res, next){
  const schema = getSchema([this.storage.models.User], options);
  return graphqlHTTP({
    schema: schema,
    graphiql: true
  })(req, res, next);
}

GraphQLRouter.prototype._definitions = function() {
  return [
    ['use', '/graphql', this._verify, graphqlHTTP(
      { schema: getSchema([this.storage.models.User], options),
        graphiql: true}
    )]
  ]
}

module.exports = GraphQLRouter;
