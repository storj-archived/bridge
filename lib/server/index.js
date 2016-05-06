'use strict';

const fs = require('fs');
const assert = require('assert');
const http = require('http');
const https = require('https');
const express = require('express');
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
}

/**
 * Creates the appropriate server
 * #_createServer
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

    if (this.options.ssl.redirect) {
      log.info('setting up http redirect to force ssl');
      http.createServer(express().use(function(req, res) {
        return res.redirect(['https://', req.hostname, req.url].join(''));
      })).listen(this.options.ssl.redirect);
    }
  } else {
    server = http.createServer(handler);
  }

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
module.exports.Routes = require('./routes');
module.exports.middleware = require('./middleware');
module.exports.errors = require('./errors');
