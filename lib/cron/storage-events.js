'use strict';

const assert = require('assert');
const CronJob = require('cron').CronJob;
const Config = require('../config');
const Storage = require('storj-service-storage-models');
const log = require('../logger');

function StorageEventsCron(config) {
  if (!(this instanceof StorageEventsCron)) {
    return new StorageEventsCron(config);
  }

  assert(config instanceof Config, 'Invalid config supplied');

  this._config = config;
}

StorageEventsCron.CRON_TIME = '* */10 * * * *'; // every ten minutes
StorageEventsCron.MAX_RUN_TIME = 600000; // 10 minutes

StorageEventsCron.prototype.start = function(callback) {
  log.info('starting the storage events cron');

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

  this.job.start();
  setImmediate(callback);
};

StorageEventsCron.prototype._run = function() {
  // TODO set timeout to stop job if running too long

  const StorageEvent = this.storage.models.StorageEvent;

  const last = Date.now() - 10; // TODO: get the last time and event id

  const cursor = StorageEvent.find({
    timestamp: { $lt: Date.now(), $gt: last }
  }).cursor();

  cursor.on('error', (err) => {
    log.error(err);
  });

  cursor.on('data', (event) => {
    //cursor.pause();
    // TODO
    // - query user for event
    // - resolve storage events as true if thresholds exceeded
  })

  cursor.on('end', () => {
    log.info('stopping run of storage events cron');
  });
}

StorageEventsCron.prototype.run = function() {
  this.storage.models.CronJob.lock(
    'StorageEventsFinality',
    StorageEventsCron.MAX_RUN_TIME,
    (err, locked) => {
      if (!locked) {
        return log.warn('StorageEventsFinality already running');
      }
      log.info('Running StorageEventsFinality cron job');
      this._run();
    });
};

module.exports = StorageEventsCron;
