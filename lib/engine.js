/**
 * @class metadisk/engine
 */

'use strict';

const assert = require('assert');
const express = require('express');
const crossorigin = require('cors');
const pkginfo = require('../package');

const Config = require('./config');
const Storage = require('./storage');
const Network = require('./network');
const Server = require('./server');
const Mailer = require('./mailer');

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
 * #start
 */
Engine.prototype.start = function() {
  this.storage = new Storage(this._config.storage);
  this.network = new Network(this._config.network);
  this.server = new Server(this._config.server, this._configureApp());
  this.mailer = new Mailer(this._config.mailer);
};

/**
 * Configures the express app and loads routes
 * #_configureApp
 */
Engine.prototype._configureApp = function() {
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

  app.use(crossorigin());

  app.get('/', function(req, res) {
    res.send({ name: pkginfo.name, version: pkginfo.version });
  });

  for (let name in routers) {
    routers[name].forEach(bindRoute);
  }

  app.use(Server.middleware.errorhandler);

  return app;
};

module.exports = Engine;
