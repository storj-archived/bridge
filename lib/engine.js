/**
 * @class metadisk/engine
 */

'use strict';

const merge = require('merge');
const assert = require('assert');
const express = require('express');
const crossorigin = require('cors');
const pkginfo = require('../package');
const protocolinfo = require('storj/package');

const Config = require('./config');
const Storage = require('./storage');
const Network = require('./network');
const Server = require('./server');
const Mailer = require('./mailer');

const log = require('./logger')();

/**
 * Primary interface to metadisk (the glue)
 * @constructor
 * @param {Config} config
 */
function Engine(config) {
  if (!(this instanceof Engine)) {
    return new Engine(config);
  }

  assert(config instanceof Config, 'Invalid config supplied');

  this._config = config;
}

/**
 * Starts the MetaDisk instance
 * @param {Function} callback
 */
Engine.prototype.start = function(callback) {
  var self = this;

  log.info('starting metadisk engine');

  self.storage = new Storage(self._config.storage);
  self.mailer = new Mailer(self._config.mailer);

  let netopts = merge(Object.create(self._config.network), {
    storage: self.storage
  });

  log.info('opening interface to storj network');

  Network.createInterface(netopts, function(err, network) {
    if (err) {
      log.error('failed to connect to storj network, reason: %s', err.message);
      return callback(err);
    }

    self.network = network;
    self.server = new Server(self._config.server, self._configureApp());
  });
};

/**
 * Configures the express app and loads routes
 */
Engine.prototype._configureApp = function() {
  log.info('configuring service endpoints');

  let self = this;
  const routers = Server.Routes(
    this._config,
    this.storage,
    this.network,
    this.mailer
  );
  const app = express();

  function bindRoute(route) {
    let verb = route.shift().toLowerCase();
    app[verb].apply(app, route);
  }

  app.use(crossorigin({
    origin: true,
    credentials: true
  }));

  app.get('/', function(req, res) {
    res.send(self._getInfo());
  });

  for (let name in routers) {
    routers[name].forEach(bindRoute);
  }

  app.use(Server.middleware.errorhandler);

  return app;
};

/**
 * Returns a dictionary of info about the service
 * @returns {Object}
 */
Engine.prototype._getInfo = function() {
  return {
    service: {
      name: pkginfo.name,
      version: pkginfo.version,
      protocol: this._config.server.ssl ? 'https:' : 'http:',
      address: this._config.server.address,
      port: this._config.server.port
    },
    network: {
      name: protocolinfo.name,
      version: protocolinfo.version,
      protocol: this._network._transports._sslopts ? 'https:' : 'http:',
      address: this._config.network.address,
      port: this._config.network.port,
      pubkeyhash: this._network._contact.nodeID
    },
    license: pkginfo.license
  };
};

module.exports = Engine;
