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

StorageEventsCron.prototype._resolveEvent = function(event, callback) {

  this.storage.models.User.findOne({_id: event.user}, (err, user) => {
    if (err) {
      return callback(err);
    }

    let success = event.success;
    let successModified = false;
    let unknown = success ? false : true;
    if (unknown) {
      resolveCodes();
    }

    function resolveCodes() {
      const failureCode = 1100;
      const successCode = 1000;

      const clientCode = event.clientReport ?
            event.clientReport.exchangeResultCode : undefined;
      const farmerCode = event.farmerReport ?
            event.farmerReport.exchangeResultCode : undefined;

      if (farmerCode == failureCode && !clientCode) {
        success = false;
        unknown = false;
        return;
      }

      if (farmerCode == failureCode && clientCode == failureCode) {
        success = false;
        unknown = false;
        return;
      }

      if (!farmerCode && clientCode == failureCode) {
        success = false;
        unknown = false;
        return;
      }

      if (user.exceedsUnknownReportsThreshold()) {
        successModified = true;
        success = true;
        unknown = true;
        return;
      }
    }

    if (successModified) {
      event.save((err) => {
        if (err)
          return callback(err);
        }
        finalize();
      });
    } else {
      finalize();
    }

    function finalize() {
      user.updateUnknownReports(unknown, event.timestamp, (err) => {
        if (err) {
          return callback(err);
        }

        callback();
      });
    });
  });
};

StorageEventsCron.prototype._run = function() {
  const StorageEvent = this.storage.models.StorageEvent;

  // TODO: get the last time and event id
  // TODO: release lock once completed and save last time
  const last = Date.now() - 10;

  const cursor = StorageEvent.find({
    timestamp: {
      $lt: Date.now(),
      $gt: last
    },
    user: {
      $exists: true
    }
  }).cursor();

  function handleError(err) {
    if (err) {
      let message = err.message ? err.message : 'unknown';
      log.error('Error running StorageEventsFinality, reason: %s', message);
      cursor.close();
    }
  }

  cursor.on('error', handleError);

  cursor.on('data', (event) => {
    cursor.pause();
    this._resolveEvent(event, (err) => {
      if (err) {
        return handleError(err);
      }
      cursor.resume();
    });
  })

  cursor.on('end', () => {
    log.info('stopping run of storage events cron');
  });

  setTimeout(() => {
    handleError(new Error('Job StorageEventsFinality exceeded max duration'));
  }, StorageEventsCron.MAX_RUN_TIME);
}

StorageEventsCron.prototype.run = function() {
  this.storage.models.CronJob.lock(
    'StorageEventsFinality', StorageEventsCron.MAX_RUN_TIME, (err, locked) => {
      if (err) {
        return log.error('StorageEvents lock failed, reason: %s', err.message);
      }
      if (!locked) {
        return log.warn('StorageEventsFinality already running');
      }
      log.info('Starting StorageEventsFinality cron job');
      this._run();
    });
};

module.exports = StorageEventsCron;
