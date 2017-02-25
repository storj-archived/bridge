'use strict';

const v8 = require('v8');
const hat = require('hat');
const async = require('async');
const storj = require('storj-lib');
const assert = require('assert');
const express = require('express');
const crossorigin = require('cors');
const pkginfo = require('../package');
const Config = require('./config');
const Storage = require('storj-service-storage-models');
const middleware = require('storj-service-middleware');
const Server = require('./server');
const Mailer = require('storj-service-mailer');
const log = require('./logger');
const ComplexClient = require('storj-complex').createClient;
const MongoDBStorageAdapter = require('storj-mongodb-adapter');

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
  this._pendingResponses = [];
  this._cpuUsage = process.cpuUsage();
  this._healthInterval = null;
}

Engine.SIGINT_CHECK_INTERVAL = 1000;
Engine.MAX_SIGINT_WAIT = 5000;
Engine.RESPONSE_CLEAN_INTERVAL = 5000;
Engine.HEALTH_INTERVAL = 30000;

/**
 * Starts the Bridge instance
 * @param {Function} callback
 */
Engine.prototype.start = function(callback) {
  log.info('starting the bridge engine');

  this.storage = new Storage(
    this._config.storage.mongoUrl,
    this._config.storage.mongoOpts,
    { logger: log }
  );
  this.mailer = new Mailer(this._config.mailer);
  this.network = new ComplexClient(this._config.complex);
  this.contracts = new storj.StorageManager(
    new MongoDBStorageAdapter(this.storage)
  );
  this.server = new Server(this._config.server, this._configureApp());

  this._healthInterval = setInterval(() => this._logHealthInfo(),
                                     Engine.HEALTH_INTERVAL);

  callback();
  process.on('SIGINT', this._handleSIGINT.bind(this));
  process.on('exit', this._handleExit.bind(this));
  process.on('uncaughtException', this._handleUncaughtException.bind(this));
};

/**
 * Handles uncaught exceptions
 * @private
 */
/* istanbul ignore next */
Engine.prototype._handleUncaughtException = function(err) {
  if (process.env.NODE_ENV === 'test') {
    throw err;
  }

  log.error('an unhandled exception occurred: %s', err.stack);
  process.exit(1);
};

/**
 * Handles exit event from process
 * @private
 */
/* istanbul ignore next */
Engine.prototype._handleExit = function() {
  log.info('bridge service is shutting down');
};

/**
 * Postpones process exit until requests are fullfilled
 * @private
 */
/* istanbul ignore next */
Engine.prototype._handleSIGINT = function() {
  let self = this;
  let waitTime = 0;

  log.info('received shutdown signal, waiting for pending responses');
  setInterval(function() {
    waitTime += Engine.SIGINT_CHECK_INTERVAL;

    if (Object.keys(self._pendingResponses).length === 0) {
      process.exit();
    }

    if (waitTime > Engine.MAX_SIGINT_WAIT) {
      process.exit();
    }
  }, Engine.SIGINT_CHECK_INTERVAL);
};

/**
 * Configures the express app and loads routes
 * @private
 */
Engine.prototype._configureApp = function() {
  log.info('configuring service endpoints');

  let self = this;
  const routers = Server.Routes({
    config: this._config,
    storage: this.storage,
    network: this.network,
    mailer: this.mailer,
    contracts: this.contracts
  });
  const app = express();

  function bindRoute(route) {
    let verb = route.shift().toLowerCase();
    app[verb].apply(app, route);
  }

  self._keepPendingResponsesClean();
  app.use(this._trackResponseStatus.bind(this));
  app.use(crossorigin({
    origin: true,
    credentials: true
  }));
  app.get('/', this._handleRootGET.bind(this));
  routers.forEach(bindRoute);
  app.use(middleware.errorhandler({ logger: log }));

  return app;
};

/**
 * Responds with the swagger spec
 * @private
 */
Engine.prototype._handleRootGET = function(req, res) {
  res.send(this.getSpecification());
};

/**
 * Keeps tabs on all of the pending responses
 * @private
 */
Engine.prototype._trackResponseStatus = function(req, res, next) {
  this._pendingResponses[hat()] = res;
  next();
};

/**
 * Clean up the pending request stack
 * @private
 */
Engine.prototype._keepPendingResponsesClean = function() {
  var self = this;

  setInterval(function() {
    for (var id in self._pendingResponses) {
      if (self._pendingResponses[id].finished) {
        delete self._pendingResponses[id];
      }
    }
  }, Engine.RESPONSE_CLEAN_INTERVAL);
};

/**
 * Count all current unfinished responses
 * @private
 */
Engine.prototype._countPendingResponses = function() {
  let count = 0;
  for (var id in this._pendingResponses) {
    if (!this._pendingResponses[id].finished) {
      count++;
    } else {
      delete this._pendingResponses[id];
    }
  }
  return count;
};

Engine.prototype._logHealthInfo = function() {
  async.series({
    connections: (next) => {
      this.server.server.getConnections(next);
    }
  }, (err, results) => {
    if (err) {
      // Error message is included in results below
      results = {};
    }

    this.cpuUsage = process.cpuUsage(this.cpuUsage);

    const health = {
      pid: process.pid,
      cpuUsage: this.cpuUsage,
      memory: process.memoryUsage(),
      heapStatistics: v8.getHeapStatistics(),
      heapSpaceStatistics: v8.getHeapSpaceStatistics(),
      uptime: process.uptime(),
      listening: this.server.server.listening,
      connections: results.connections,
      pendingResponses: this._countPendingResponses(),
      databaseState: this.storage.connection.readyState
    };

    if (err) {
      health.error = err.message;
    }

    log.info('%j', { bridge_health_report: health });
  });
};

/**
 * Returns a dictionary of info about the service
 * @returns {Object}
 */
Engine.prototype.getSpecification = function() {
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

  return this._apispec;
};

module.exports = Engine;
