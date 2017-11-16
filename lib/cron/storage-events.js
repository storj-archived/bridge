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
StorageEventsCron.FINALITY_TIME = 10800000 // 3 hours

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
  const threshold = this._config.application.unknownReportThreshold;

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

      if (user.exceedsUnknownReportsThreshold(threshold)) {
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

        callback(null, event.timestamp);
      });
    });
  });
};

StorageEventsCron.prototype._run = function(lastTimestamp, callback) {

  const StorageEvent = this.storage.models.StorageEvent;
  const finalityTime = Date.now() - StorageEventsCron.FINALITY_TIME;

  const cursor = StorageEvent.find({
    timestamp: {
      $lt: finalityTime,
      $gt: lastTimestamp
    },
    user: {
      $exists: true
    }
  }).sort({timestamp: 1}).cursor();

  const timeout = setTimeout(() => {
    finish(new Error('Job exceeded max duration'));
  }, StorageEventsCron.MAX_RUN_TIME);

  let callbackCalled = false;

  function finish(err) {
    clearTimeout(timeout);
    cursor.close();
    if (!callbackCalled) {
      callbackCalled = true;
      callback(err, lastTimestamp);
    }
  }

  cursor.on('error', finish);

  cursor.on('data', (event) => {
    cursor.pause();
    this._resolveEvent(event, (err, _lastTimestamp) => {
      if (err) {
        return finish(err);
      }
      lastTimestamp = _lastTimestamp;
      cursor.resume();
    });
  })

  cursor.on('end', finish);
}

StorageEventsCron.prototype.run = function() {
  const name = 'StorageEventsFinality';
  const Cron = this.storage.models.CronJob;
  Cron.lock(name, StorageEventsCron.MAX_RUN_TIME, (err, locked, res) => {
    if (err) {
      return log.error('StorageEvents lock failed, reason: %s', err.message);
    }
    if (!locked) {
      return log.warn('StorageEventsFinality already running');
    }

    log.info('Starting StorageEventsFinality cron job');

    let lastTimestamp = new Date(0);
    if (res.value && res.value.rawData && res.value.rawData.lastTimestamp) {
      lastTimestamp = new Date(res.value.rawData.lastTimestamp);
    } else {
      log.warn('StorageEventsFinality cron has unknown lastTimestamp');
    }

    this._run(lastTimestamp, (err, _lastTimestamp) => {
      if (err) {
        let message = err.message ? err.message : 'unknown';
        log.error('Error running StorageEventsFinality, reason: %s', message);
      }

      log.info('Stopping StorageEventsFinality cron');
      const rawData = {};
      if (_lastTimestamp) {
        rawData.lastTimestamp = _lastTimestamp;
      }

      Cron.unlock(name, rawData, (err) => {
        if (err) {
          return log.error('StorageEvents unlock failed, reason: %s', err.message);
        }
      });

    });
  });
};

module.exports = StorageEventsCron;
