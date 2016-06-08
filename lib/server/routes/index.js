'use strict';

const assert = require('assert');
const RenterPool = require('../../network/pool');
const Config = require('../../config');
const Storage = require('../../storage');
const Mailer = require('../../mailer');

/**
 * Abstract representation of a route series
 * @constructor
 * @param {Config}
 * @param {storj.RenterInterface}
 * @param {Storage}
 * @param {Mailer}
 */
function Router(config, network, storage, mailer) {
  if (!(this instanceof Router)) {
    return new Router(config, network, storage, mailer);
  }

  assert(config instanceof Config, 'Invalid config supplied');
  assert(network instanceof RenterPool, 'Invalid network supplied');
  assert(storage instanceof Storage, 'Invalid storage supplied');
  assert(mailer instanceof Mailer, 'Invalid mailer supplied');

  this.config = config;
  this.network = network;
  this.storage = storage;
  this.mailer = mailer;
}

/**
 * Returns the result of the private _definitions method
 * @returns {Array}
 */
Router.prototype.getEndpointDefinitions = function() {
  var self = this;

  return this._definitions().map(function(def) {
    return def.map(function(val) {
      if (typeof val === 'function') {
        return val.bind(self);
      } else {
        return val;
      }
    });
  });
};

module.exports = Router;
