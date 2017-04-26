'use strict';

const async = require('async');
const assert = require('assert');
const crypto = require('crypto');
const storj = require('storj-lib');
const MonitorConfig = require('./config');
const Storage = require('storj-service-storage-models');
const ComplexClient = require('storj-complex').createClient;
const MongoDBStorageAdapter = require('storj-mongodb-adapter');
const ms = require('ms');
const log = require('../logger');
const errors = require('storj-service-error-types');

/**
 * A long running daemon that will monitor farmers uptime and will replace
 * contracts associated with a farmer once the farmer is confirmed to be
 * offline for a duration of time.
 * @param {MonitorConfig} config - An instance of MonitorConfig
 */
function Monitor(config) {
  if (!(this instanceof Monitor)) {
    return new Monitor(config);
  }

  assert(config instanceof MonitorConfig, 'Invalid config supplied');

  this.storage = null;
  this.network = null;
  this.contracts = null;

  this._config = config;
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
  log.info('Farmer monitor service is starting');

  this.storage = new Storage(
    this._config.storage.mongoUrl,
    this._config.storage.mongoOpts,
    { logger: log }
  );

  this.network = new ComplexClient(this._config.complex);

  this.contracts = new storj.StorageManager(
    new MongoDBStorageAdapter(this.storage),
    { disableReaper: true }
  );

  // setup next run event
  this.wait();

  callback();
  process.on('SIGINT', this._handleSIGINT.bind(this));
  process.on('exit', this._handleExit.bind(this));
  process.on('uncaughtException', this._handleUncaughtException.bind(this));
};

Monitor.sortByTimeoutRate = function(a, b) {
  const a1 = a.contact.timeoutRate >= 0 ? a.contact.timeoutRate : 0;
  const b1 = b.contact.timeoutRate >= 0 ? b.contact.timeoutRate : 0;
  return (a1 === b1) ? 0 : (a1 > b1) ? 1 : -1;
};

Monitor.prototype._fetchDestinations = function(shard, callback) {
  this.storage.models.Mirror
    .find({ shardHash: shard.hash })
    .populate('contact')
    .exec((err, results) => {
      if (err) {
        return callback(err);
      }
      const mirrors = results.filter((m) => {
        if (!m.contact) {
          log.warn('Mirror %s is missing contact in database', m._id);
          return false;
        } else if (shard.contracts[m.contact._id]) {
          log.warn('Shard %s already established to contact %s',
                   shard.hash, m.contact._id);
          return false;
        } else if (!m.isEstablished) {
          return true;
        }
        return false;
      });
      mirrors.sort(Monitor.sortByTimeoutRate);
      callback(null, mirrors);
    });
};

Monitor.prototype._fetchSources = function(shard, callback) {
  let farmers = Object.keys(shard.contracts);

  this.storage.models.Contact
    .find({ _id: { $in: farmers }})
    .sort({ lastSeen: -1 })
    .exec((err, results) => {
      if (err) {
        return callback(err);
      }

      let contacts = [];
      for (let i = 0; i < results.length; i++) {
        let c = results[i];
        let contact = null;
        try {
          contact = storj.Contact(c.toObject());
        } catch(e) {
          log.warn('Unable to fetch source, invalid contact: %j', c.toObject());
        }
        if (contact) {
          contacts.push(contact);
        }
      }

      callback(null, contacts);
    });
};

Monitor.prototype._saveShard = function(shard, destination, callback) {

  const contract = storj.Contract(destination.contract);
  const contact = storj.Contact(destination.contact);
  shard.addContract(contact, contract);

  this.contracts.save(shard, (err) => {
    if (err) {
      return callback(new Error('Unable to save contract to shard'));
    }

    log.info('Successfully replicated shard %s', shard.hash);
    destination.isEstablished = true;
    destination.save((err) => {
      if (err) {
        return callback(
          new Error('Unable to update mirror as established, reason: ' +
                    err.message)
        );
      }
      callback();
    });
  });
};

Monitor.prototype._transferShard = function(shard, state, callback) {
  const source = state.sources[0];
  const destination = state.destinations[0];

  if (!source) {
    return callback(new Error('Sources exhausted'));
  }

  if (!destination) {
    return callback(new Error('Destinations exhausted'));
  }

  let contract = null;
  try {
    contract = shard.getContract(source);
  } catch(e) {
    log.warn('Unable to transfer shard, invalid contract: %j',
             destination.contract);
    state.destinations.shift();
    this._transferShard(shard, state, callback);
    return;
  }

  this.network.getRetrievalPointer(source, contract, (err, pointer) => {
    if (err || !pointer) {
      log.warn('Failed to get retrieval pointer from farmer %s, reason: %s',
               source, err ? err.message : null);

      state.sources.shift();
      this._transferShard(shard, state, callback);
      return;
    }

    const farmer = storj.Contact(destination.contact);

    this.network.getMirrorNodes([pointer], [farmer], (err) => {
      if (err) {
        log.warn('Unable to mirror to farmer %s, reason: %s',
                 destination, err.message);
        state.destinations.shift();
        this._transferShard(shard, state, callback);
        return;
      }

      this._saveShard(shard, destination, callback);
    });
  });
};

Monitor.prototype._replicateShard = function(shard, callback) {
  async.parallel({
    destinations: (next) => {
      this._fetchDestinations(shard, next);
    },
    sources: (next) => {
      this._fetchSources(shard, next);
    }
  }, (err, state) => {
    if (err) {
      return callback(err);
    }
    this._transferShard(shard, state, callback);
  });
};

Monitor.prototype._replicateFarmer = function(contact) {
  log.info('Starting to replicate farmer %s', contact.nodeID);

  const query = {
    'contracts.nodeID': contact.nodeID
  };
  const cursor = this.storage.models.Shard.find(query).cursor();

  cursor
    .on('error', (err) => {
      log.error('Unable to replicate farmer %s, reason: %s',
                contact.nodeID, err.message);
    })
    .on('data', (data) => {
      cursor.pause();
      const shard = storj.StorageItem(data.toObject());
      log.info('Replicating shard %s for farmer', shard.hash, contact.nodeID);
      this._replicateShard(shard, (err) => {
        if (err) {
          log.error('Unable to replicate shard %s, reason: %s',
                    shard.hash, err.message);
        }
        cursor.resume();
      });
    })
    .on('close', () => {
      log.info('Ending replication of farmer %s', contact.nodeID);
    });
};

Monitor.prototype.run = function() {
  if (this._running) {
    return this.wait();
  }

  let fail = 0;
  let success = 0;
  let total = 0;
  const limit = this._config.application.queryNumber || 10;
  const pingConcurrency = this._config.application.pingConcurrency || 10;
  const timeoutRateThreshold = this._config.application.timeoutRateThreshold;

  const finish = (err) => {
    if (err) {
      log.error(err);
    }
    log.info('Ending farmer monitor round with failure rate of %s/%s from %s',
             fail, success, total);
    this._running = false;
    this.wait();
  };

  log.info('Starting farmer monitor round for %s contacts', limit);
  this._running = true;

  // Query the least seen contacts with timeout rates below threshold
  const Contact = this.storage.models.Contact;
  const query = {
    $or: [
      { timeoutRate: { $lt: timeoutRateThreshold } },
      { timeoutRate: { $exists: false } }
    ]
  };

  const cursor = Contact.find(query).limit(limit).sort({lastSeen: 1});
  cursor.exec((err, contacts) => {
    if (err) {
      return finish(err);
    }

    if (!contacts) {
      return finish(
        new errors.InternalError('No contacts in contacts collection')
      );
    }

    // Update total length of contacts
    total = contacts.length;

    // Ping the least seen contacts
    async.eachLimit(contacts, pingConcurrency, (contactData, next) => {

      const contact = storj.Contact(contactData);

      this.network.ping(contact, (err) => {
        if (err) {
          fail += 1;
          log.error('Farmer %s failed ping, reason: %s',
                    contact.nodeID, err.message);

          contactData.recordTimeoutFailure().save((err) => {
            if (err) {
              log.error('Unable to save ping failure, farmer: %s, reason: %s',
                        contact.nodeID, err.message);
            }
          });

          if (contactData.timeoutRate >= timeoutRateThreshold) {
            log.warn('Shards need replication, farmer: %s, timeoutRate: %s',
                     contact.nodeID, contactData.timeoutRate);
            this._replicateFarmer(contact);
          }

        } else {
          success += 1;
        }

        next();
      });

    }, finish);

  });

};

Monitor.prototype._randomTime = function(max, min) {
  const range = max - min;

  assert(Number.isSafeInteger(range));
  assert(range > 0, 'maxInterval is expected to be greater than minInterval');

  const entropy = crypto.randomBytes(8).toString('hex');
  const offset = Math.round(parseInt('0x' + entropy) / Math.pow(2, 64) * range);

  return min + offset;
};

/**
 * Will wait and then call `run` after a random amount of time
 */
Monitor.prototype.wait = function() {
  clearTimeout(this._timeout);

  const max = ms(this._config.application.maxInterval);
  const min = ms(this._config.application.minInterval);

  const milliseconds = this._randomTime(max, min);
  const minutes = Number(milliseconds / 1000 / 60).toFixed(2);

  log.info('Scheduling next round in %s minutes', minutes);

  this._timeout = setTimeout(() => this.run(), milliseconds);
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

  log.error('An unhandled exception occurred:', err);
  process.exit(1);
};

/**
 * Handles exit event from process
 * @private
 */
/* istanbul ignore next */
Monitor.prototype._handleExit = function() {
  log.info('Farmer monitor service is shutting down');
};

/**
 * Postpones process exit until requests are fullfilled
 * @private
 */
/* istanbul ignore next */
Monitor.prototype._handleSIGINT = function() {
  let waitTime = 0;

  log.info('Received shutdown signal, checking for running monitor');
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
