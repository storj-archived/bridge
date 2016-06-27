'use strict';

const storj = require('storj');
const assert = require('assert');
const express = require('express');
const crossorigin = require('cors');
const pkginfo = require('../package');

const Config = require('./config');
const Storage = require('./storage');
const RenterPool = require('./network/pool');
const Server = require('./server');
const Mailer = require('./mailer');
const Messaging = require('./messaging');

const log = require('./logger');

/**
 * Primary interface to Bridge (the glue)
 * @constructor
 * @param {Config} config
 */
function Engine(config) {
  if (!(this instanceof Engine)) {
    return new Engine(config);
  }

  assert(config instanceof Config, 'Invalid config supplied');

  this._config = config;
  this._apispec = null;
}

/**
 * Starts the Bridge instance
 * @param {Function} callback
 */
Engine.prototype.start = function(callback) {
  var self = this;

  self.messaging = new Messaging(self._config.messaging);

  log.info('starting the bridge engine');
  self.storage = new Storage(self._config.storage);
  self.mailer = new Mailer(self._config.mailer);
  self._config.network.storage = self.storage;

  log.info('opening interface to storj network');

  self.network = new RenterPool(self._config.network, self.messaging);
  self.server = new Server(self._config.server, self._configureApp());

  self.network.on('ready', () => {
    self.messaging.start(callback);
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
    res.send(self.getSpecification());
  });

  routers.forEach(bindRoute);
  app.use(Server.middleware.errorhandler);

  return app;
};

/**
 * Returns a dictionary of info about the service
 * @returns {Object}
 */
Engine.prototype.getSpecification = function() {
  let self = this;

  if (!this._apispec) {
    this._apispec = require('./apispec.json');
    this._apispec.schemes = this._config.server.ssl.cert ? ['https'] : ['http'];
    this._apispec.host = this._config.server.host;
    this._apispec.info = {
      title: 'Storj Bridge',
      version: pkginfo.version,
      description: pkginfo.description,
      'x-protocol-version': storj.version.protocol,
      'x-core-version': storj.version.software
    };
    if (this.network) {
      this._apispec.info['x-network-seeds'] = this._config.network.minions.map(
        function(net) {
          return 'storj://' + net.address + ':' + net.port + '/' +
                 storj.KeyPair(self._config.network.privkey).getNodeID();
        }
      );
    }
  }

  return this._apispec;
};

module.exports = Engine;
