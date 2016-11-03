'use strict';

/**
 * Abstract representation of a route series
 * @constructor
 * @param {Object} options
 * @param {Config} options.config
 * @param {complex.Client} options.network
 * @param {Storage} options.storage
 * @param {Mailer} options.mailer
 */
function Router(options) {
  if (!(this instanceof Router)) {
    return new Router(options);
  }

  this.config = options.config;
  this.network = options.network;
  this.storage = options.storage;
  this.mailer = options.mailer;
  this.contracts = options.contracts;
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
