'use strict';

const Router = require('./index');
const errors = require('../errors');
const inherits = require('util').inherits;
const graphqlHTTP = require('express-graphql');
const graphql = require('graphql');
const authenticate = require('../middleware').authenticate;
const schema = require('../../storage/graphql/schema');

/**
 * GraphQLRouter
 * @param options {Object}:
 *  + config {Config}
 *  + storage {Storage}
 *  + network {storj.RenterInterface}
 *  + mailer {Mailer}
 * @return {GraphQLRouter}
 * @constructor
 */
function GraphQLRouter(options) {
  if (!(this instanceof GraphQLRouter)) {
    return new GraphQLRouter(options);
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

GraphQLRouter.prototype.graphqlMiddleware = function(req, res, next){
  graphqlHTTP(
      {schema: schema(this.storage.models, req)},
      options
  )(req, res, next);
};


GraphQLRouter.DEFAULTS = {
  skip: 0,
  limit: 30
};

GraphQLRouter.prototype._definitions = function() {
  return [
    ['POST', '/graphql', this._verify, this.graphqlMiddleware]
  ];
};

module.exports = GraphQLRouter;
