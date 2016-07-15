'use strict';

const Async = require('async');
const Verification = require('storj').Verification;
const storj = require('storj');
const logger = require('../logger');
const Config = require('../config');
const Storage = require('../storage');
const MongoAdapter = require('../storage/adapter');

const storageConfig = Config(process.env.NODE_ENV || 'devel').storage;
const storageAdapter = Storage(storageConfig);
const mongoAdapter = new MongoAdapter(storageAdapter);
const manager = new storj.Manager(mongoAdapter);

const AuditQueue = require('./queue.js');
const AuditDispatcher = require('./dispatcher.js');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - max simultaneous outgoing requests per worker
 */
 //TODO: Worker Process storj & redis failure
const AuditQueueWorker = function(options) {
  this._options = options;
  this._queue = new AuditQueue(this._options.redis, this._options.uuid);

  storageAdapter.models.Contact.recall(3, this._createConnection.bind(this));
};

AuditQueueWorker.prototype._createConnection = function(err, seeds) {
  if (err) {
    logger.error(err);
    process.exit();
  }

  this._connection = storj.RenterInterface({
    keypair: storj.KeyPair(this._options.network.privkey),
    manager: manager,
    logger: logger,
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

  this._dispatcher = new AuditDispatcher(this._queue, this._connection);
  this._flushStalePendingQueue(this._initDispatchQueue);
};

AuditQueueWorker.prototype._flushStalePendingQueue = function(callback) {
  var self = this;

  var pendingQueue = Async.queue(
    this._processAudit.bind(this),
    this._options.limit
  );

  this._queue.getPendingQueue(function(err, pendingAudits) {
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
    this._processAudit.bind(this),
    this._options.limit
  );

  while(i < this._options.limit) {
    i++;
    queueNext(null);
  }

  function queueNext(err) {
    if(err) logger.error(err);
    self._dispatcher._get(function(err, audit) {
      if(err) {
        logger.error(err);
        queueNext(null);
      }

      dispatchQueue.push(audit, queueNext);
    });
  }
};

AuditQueueWorker.prototype._processAudit = function(audit, nextAudit) {
  Async.waterfall([
    Async.apply(this._dispatcher._verify, audit),
    this._dispatcher._commit
  ], function done(err) {
    if(err) logger.error(err);
    return nextAudit();
  });
};

module.exports = AuditQueueWorker;
