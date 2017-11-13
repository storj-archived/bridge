'use strict';

const assert = require('assert');
const CronJob = require('cron').CronJob;
const Config = require('../config');
const Storage = require('storj-service-storage-models');
const log = require('../logger');

function StorageEventsCron(config) {
  if (!(this instanceof Engine)) {
    return new Engine(config);
  }

  assert(config instanceof Config, 'Invalid config supplied');

  this._config = config;
}

StorageEventsCron.CRON_TIME = '00 00 * * * *';

StorageEventsCron.prototype.start = function(callback) {
  log.info('starting the bridge engine');

  this.storage = new Storage(
    this._config.storage.mongoUrl,
    this._config.storage.mongoOpts,
    { logger: log }
  );

  this.job = new CronJob({
    cronTime: StorageEventsCron.CRON_TIME,
    onTick: this.run.bind(this),
    start: false,
    timeZone: 'UTC'
  });

  job.start();
  setImmediate(callback);
};

StorageEventsCron.prototype.run = function() {

  // TODO
  // - Read the latest storage events since the last update
  // - Update user statistics for reporting
  // - Resolve storage events as true if thresholds exceeded

};

module.exports = StorageEventsCron;
