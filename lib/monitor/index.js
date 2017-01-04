'use strict';

const storj = require('storj-lib');
const Config = require('./config');
const Storage = require('storj-service-storage-models');
const ComplexClient = require('storj-complex').createClient;
const MongoDBStorageAdapter = require('storj-mongodb-adapter');
const log = require('../logger');

/**
 * A long running daemon that will monitor farmers uptime and will issue mirror
 * requests once
 */
function Monitor() {
  if (!(this instanceof Monitor)) {
    return new Monitor(config);
  }

  assert(config instanceof Config, 'Invalid config supplied');
  this._config = config;
  this._pendingResponses = [];
}

Monitor.SIGINT_CHECK_INTERVAL = 1000;
Monitor.MAX_SIGINT_WAIT = 5000;

/**
 * Starts the Bridge instance
 * @param {Function} callback
 */
Monitor.prototype.start = function(callback) {
  log.info('starting the farmer monitor');

  this.storage = new Storage(
    this._config.storage.mongoUrl,
    this._config.storage.mongoOpts,
    { logger: log }
  );
  this.network = new ComplexClient(this._config.complex);
  this.contracts = new storj.StorageManager(
    new MongoDBStorageAdapter(this.storage)
  );

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
Monitor.prototype._handleUncaughtException = function(err) {
  if (process.env.NODE_ENV === 'test') {
    throw err;
  }

  log.error('an unhandled exception occurred: %s', err.message);
  process.exit(1);
};

/**
 * Handles exit event from process
 * @private
 */
/* istanbul ignore next */
Monitor.prototype._handleExit = function() {
  log.info('bridge service is shutting down');
};

/**
 * Postpones process exit until requests are fullfilled
 * @private
 */
/* istanbul ignore next */
Monitor.prototype._handleSIGINT = function() {
  let self = this;
  let waitTime = 0;

  log.info('received shutdown signal, waiting for pending responses');
  setInterval(function() {
    waitTime += Monitor.SIGINT_CHECK_INTERVAL;

    if (Object.keys(self._pendingResponses).length === 0) {
      process.exit();
    }

    if (waitTime > Monitor.MAX_SIGINT_WAIT) {
      process.exit();
    }
  }, Monitor.SIGINT_CHECK_INTERVAL);
};

module.exports = Monitor;
