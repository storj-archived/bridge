'use strict';

const crypto = require('crypto');
const storj = require('storj-lib');
const Config = require('./config');
const Storage = require('storj-service-storage-models');
const ComplexClient = require('storj-complex').createClient;
const MongoDBStorageAdapter = require('storj-mongodb-adapter');
const ms = require('ms');
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
  this._timeout = null;
  this._running = false;
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

Monitor.prototype.run = function(callback) {
  if (this._running) {
    return this.wait();
  }
  this._running = true;

  // TODO
  // - query the least seen contacts
  // - if there is failure record the failure on the contact
  // - if there has been beyond threshold of ellapsed time since the last
  //   failure, trigger mirror replication, and mark the existing mirror
  //   as invalid/failed.
};

Monitor.prototype._replicate = function() {

  // TODO
  // invalidate contract, and disable the mirror
  // trigger a new mirror to be created
};

Monitor.prototype._randomTime = function() {
  const max = ms(this._config.application.maxInterval);
  const min = ms(this._config.application.minInterval);
  const range = max - min;

  assert(Number.isSafeInteger(range));
  assert(range > 0, 'maxInterval is expected to be greater than minInterval');

  const entropy = crypto.randomBytes(8).toString('hex');
  const offset = Math.round(parseInt('0x' + entropy) / Math.pow(2, 64) * range);

  return min + offset;
};

/**
 * Will wait an then call `run` after a random amount of time
 */
Monitor.prototype.wait = function(err) {
  clearTimeout(this._timeout);
  this._timeout = setTimeout(() => this.run(), this._randomTime());
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

  // TODO include stack trace
  log.error('an unhandled exception occurred: %s', err.message);
  process.exit(1);
};

/**
 * Handles exit event from process
 * @private
 */
/* istanbul ignore next */
Monitor.prototype._handleExit = function() {
  log.info('monitor service is shutting down');
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

    if (!this._running) {
      process.exit();
    }

    if (waitTime > Monitor.MAX_SIGINT_WAIT) {
      process.exit();
    }
  }, Monitor.SIGINT_CHECK_INTERVAL);
};

module.exports = Monitor;
