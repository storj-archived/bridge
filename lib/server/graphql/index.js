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
  /**
   * currentUser - (async) looks up user based on
   * current request's `x-pubkey` header
   * @return promise {Promise}: mongoose `User.findOne` promise
   */
  get currentUser() {
    if (!_models) {
      return Promise.reject(new Error('graphql schema hasn\'t processed any requests!'));
    }

    const publicKeyHeader = _lastRequest.header('x-pubkey');
    if (!publicKeyHeader) {
      return Promise.reject({status: 'error', message: 'Request not authenticated via ECDSA.'});
    }

    return this.models.PublicKey.findOne({_id: publicKeyHeader})
        .then((publicKey)=> {
          return this.models.User.findOne({_id: publicKey.user});
        });
  }
};
