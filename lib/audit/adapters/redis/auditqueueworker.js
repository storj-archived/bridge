'use strict';

const inherits = require('util').inherits;
const assert = require('assert');
const Async = require('async');
const Verification = require('storj').Verification;
const storj = require('storj');
const log = require('../../../../lib/logger');
const Config = require('../../../config');
const Storage = require('../../../storage');
const MongoAdapter = require('../../../storage/adapter');

const storageConfig = Config(process.env.NODE_ENV || 'devel').storage;
const storageAdapter = Storage(storageConfig);
const mongoAdapter = new MongoAdapter(storageAdapter);
const manager = new storj.Manager(mongoAdapter);

const Auditor = require('./auditor.js');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - max simultaneous outgoing requests per worker
 */

const AuditQueueWorker = function(options) {
  console.log(options)
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

  this._auditor = new Auditor(this._connection, this._options.redis, this._options.uuid);

  this._flushStalePendingQueue(this._initDispatchQueue);
};

AuditQueueWorker.prototype._flushStalePendingQueue = function(callback) {
  var self = this;

  var pendingQueue = Async.queue(
    this._auditor.process.bind(this._auditor),
    this._options.limit
  );

  this._auditor.getPendingQueue(function(err, pendingAudits) {
    if(pendingAudits.length > 0) {
      pendingQueue.push(pendingAudits);
    }

    pendingQueue.drain = callback.bind(self);
  });
};

AuditQueueWorker.prototype._initDispatchQueue = function() {
  var self = this;
  var i = 0;

  var dispatchQueue = Async.queue(
    this._auditor.process.bind(this._auditor),
    this._options.limit
  );

  while(i < this._options.limit) {
    i++;
    queueNext(null);
  }

  function queueNext(err) {
    if(err) log.error(err);
    self._auditor.get(function(err, audit) {
      if(err) {
        log.error(err);
        queueNext(null);
      }

      dispatchQueue.push(audit, queueNext);
    });
  }
};

module.exports = AuditQueueWorker;
