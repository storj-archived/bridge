'use strict';

const fs = require('fs');
const assert = require('assert');
const http = require('http');
const https = require('https');
const log = require('../logger');

/**
 * Setup HTTP(S) server for REST API
 * @constructor
 * @param {Object} options
 * @param {Function} app - express app or request handler
 */
function Server(options, app) {
  if (!(this instanceof Server)) {
    return new Server(options, app);
  }

  assert(typeof options === 'object', 'Invalid options supplied');
  assert(typeof app === 'function', 'Invalid request handler supplied');

  this.options = options;
  this.server = this._createServer(app);
  this.app = app;
}

/**
 * Creates the appropriate server
 * @private
 * @param {Function} handler - request handler
 */
Server.prototype._createServer = function(handler) {
  let server = null;

  log.info('setting up http(s) server instance');

  if (this.isConfiguredForSSL()) {
    server = https.createServer({
      cert: fs.readFileSync(this.options.ssl.cert),
      key: fs.readFileSync(this.options.ssl.key),
      ca: this.options.ssl.ca.map(function(ca) {
        return fs.readFileSync(ca);
      })
    }, handler);
  } else {
    server = http.createServer(handler);
  }

  server.timeout = this.options.timeout;
  server.listen(this.options.port);

  return server;
};

/**
 * Determines if this server should use SSL
 * #isConfiguredForSSL
 * @returns {Boolean}
 */
Server.prototype.isConfiguredForSSL = function() {
  if (!this.options.ssl) {
    return false;
  }

  let hasCert = !!this.options.ssl.cert;
  let hasKey = !!this.options.ssl.key;
  let hasCertAuth = Array.isArray(this.options.ssl.ca);

  return hasCert && hasKey && hasCertAuth;
};

module.exports = Server;
module.exports.Routes = require('./routefactory');
