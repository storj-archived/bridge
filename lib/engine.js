'use strict';

const storj = require('storj');
const merge = require('merge');
const assert = require('assert');
const express = require('express');
const crossorigin = require('cors');
const pkginfo = require('../package');

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
  this._apispec = null;
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
    res.send(self.getSpecification());
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
Engine.prototype.getSpecification = function() {
  if (!this._apispec) {
    this._apispec = require('./apispec.json');
    this._apispec.schemes = this._config.server.ssl.cert ? ['https'] : ['http'];
    this._apispec.host = this._config.server.host;
    this._apispec.info = {
      title: 'MetaDisk API',
      version: pkginfo.version,
      description: pkginfo.description
    };
    this._apispec.info['x-network-seed'] = storj.utils.getContactURL(
      this.network._contact
    );
  }

  return this._apispec;
};

module.exports = Engine;
