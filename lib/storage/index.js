/**
 * @class metadisk/storage
 */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

/**
 * MongoDB storage interface
 * @constructor
 * @param {Object} options
 */
function Storage(options) {
  if (!(this instanceof Storage)) {
    return new Storage(options);
  }

  assert(typeof options === 'object', 'Invalid storage options supplied');
  assert(typeof options.host !== 'undefined', 'Invalid host supplied');
  assert(typeof options.port !== 'undefined', 'Invalid port supplied');
  assert(typeof options.name !== 'undefined', 'Invalid name supplied');

  this.options = options;
  this.connection = this._connect();
  this.models = this._createBoundModels();
}

/**
 * Connects to the database
 * #_connect
 * @returns {mongoose.Connection}
 */
Storage.prototype._connect = function() {
 return mongoose.createConnection(this._getConnectionURI());
};

/**
 * Build the connection URI from options
 * #_getConnectionURI
 * @returns {String}
 */
Storage.prototype._getConnectionURI = function() {
  var proto = 'mongodb://';
  var address = this._options.host + ':' + this._options.port;
  var dbname = '/' + this._options.name;
  var creds = this._options.user && this._options.pass ?
             this._options.user + ':' + this._options.pass + '@' : '';

  return [proto, creds, address, dbname].join('');
};

/**
 * Return a dictionary of models bound to this connection
 * #_createBoundModels
 * @returns {Object}
 */
Storage.prototype._createBoundModels = function() {
  var bound = {};
  var models = {
    Bucket: require('./models/bucket'),
    PublicKey: require('./models/pubkey'),
    User: require('./models/user')
  };

  for (let model in models) {
    bound[model] = models[model](this.connection);
  }

  return bound;
};

module.exports = Storage;
