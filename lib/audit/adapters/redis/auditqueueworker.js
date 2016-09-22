'use strict';

const Async = require('async');
const storj = require('storj');
const log = require('../../../../lib/logger');
const Config = require('../../../config');
const Storage = require('../../../storage');
const MongoAdapter = require('../../../storage/adapter');

const storageConfig = Config(process.env.NODE_ENV || 'devel').storage;
const storageAdapter = Storage(storageConfig);
const mongoAdapter = new MongoAdapter(storageAdapter);
const manager = new storj.StorageManager(mongoAdapter);

const Auditor = require('./auditor.js');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - max simultaneous outgoing requests per worker
 */

function AuditQueueWorker(options) {
  this._options = options;
  storageAdapter.models.Contact.recall(3, this._createConnection.bind(this));
};

AuditQueueWorker.prototype._createConnection = function(err, seeds) {
  if (err) {
    log.error(err);
    process.exit();
  }

  this._connection = storj.RenterInterface({
    keypair: storj.KeyPair(this._options.network.privkey),
    manager: manager,
    logger: log,
    seeds: seeds.map(function(seed) {
      return seed.toString();
    }),
    bridge: false,
    address: this._options.network.address,
    port: this._options.network.port,
    tunnels: this._options.network.tunnels,
    noforward: true,
    tunport: this._options.network.tunport,
    gateways: this._options.network.gateways
  });

  this._auditor = new Auditor(
    this._connection,
    storageAdapter,
    mongoAdapter,
    this._options.redis,
    this._options.uuid
  );

  this._flushStalePendingQueue(this._initDispatchQueue.bind(this));
};

AuditQueueWorker.prototype._flushStalePendingQueue = function(callback) {
  var pendingQueue = Async.queue(
    this._auditor.process.bind(this._auditor),
    this._options.limit
  );

  this._auditor.getPendingQueue(function(err, pendingAudits) {
    pendingQueue.push(pendingAudits);
    pendingQueue.drain = function() {
      return callback();
    };
  });
};

AuditQueueWorker.prototype._initDispatchQueue = function() {
  var isWaiting = false;
  var outstandingGets;
  var retrievedAudits = 0;

  var getQueue = Async.queue(
    getAudits.bind(this),
    this._options.limit
  );

  var dispatchQueue = Async.queue(
    this._auditor.process.bind(this._auditor),
    this._options.limit
  );

  while(retrievedAudits < this._options.limit) {
    retrievedAudits++;
    getQueue.push(this._auditor.get.bind(this._auditor));
  }

  function getAudits(getMethod, done) {
    getMethod(function(err, audit) {
      if(err) {
        log.error(err);
        getQueue.unshift(getMethod.bind(this._auditor));
        return done(null);
      } else if(audit === null) {
        if(!isWaiting) {
          isWaiting = true;
          getQueue.push(this._auditor.awaitGet.bind(this._auditor), function(err) {
            isWaiting = false;
            outstandingGets = getQueue.length() + getQueue.running();
            while(outstandingGets < this._options.limit) {
              getQueue.push(this._auditor.get.bind(this._auditor));
              outstandingGets = getQueue.length() + getQueue.running();
            }
          }.bind(this));
        }
        return done(null);
      } else {
        getQueue.push(this._auditor.get.bind(this._auditor));
        dispatchQueue.push(audit, function(err) {
          return done(null);
        }.bind(this));
      }
    }.bind(this));
  }
};

module.exports = AuditQueueWorker;
