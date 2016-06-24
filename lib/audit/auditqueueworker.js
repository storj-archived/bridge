'use strict';

const Async = require('async');
const Verification = require('storj').Verification;
const Storage = require('../storage');
const log = require('../logger');
const config = JSON.parse(process.argv[2]);
//const Config = require('../config')(process.env.NODE_ENV || 'devel');
const AuditQueue = require('./queue.js');
const AuditDispatcher = require('./dispatcher.js');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - ceiling of simultaneous outgoing requests
 */
const AuditQueueWorker = function(options) {
  var self = this;
  this._options = options;
  this._queue = new AuditQueue(this._options.redis, this._options.uuid);
  this._connection = {}//new AuditInterface();
  this._dispatcher = new AuditDispatcher(this._queue, this._connection);
  this._flushStalePendingQueue(function() {
    this._initDispatchQueue(function() {

    });
  });

/*
  let netopts = Object.assign(Object.create(this._options.network), {
    storage: new Storage(Config.storage)
  });

  Network.createInterface(netopts, function(err, network) {
    if(err) {
      console.log('failed to connect to storj network, reason: ' + err.message);
    }
    self._network = network;
    //self.audit = new AuditQueue(self._config.redis);
  });
*/
}

AuditQueueWorker.prototype._flushStalePendingQueue = function(callback) {
  var pendingQueue = Async.queue(proccessPendingQueue, this._options.limit);

  function proccessPendingQueue(audit, callback) {
    this._dispatcher._verify(audit, commitToFinal);
  }

  function commitToFinal(err, audit, hasPassed, callback) {
    this._dispatcher._commit(audit, hasPassed, callback);
  }

  this._queue.getPendingQueue(function(err, pendingAudits) {
    if(pendingAudits.length > 0) {
      pendingQueue.push(pendingAudits, function(err) {
        console.log(err);
      });
    }
  });

  pendingQueue.drain = callback;
};

AuditQueueWorker.prototype._initDispatchQueue = function(callback) {
  var i = 0;
  var processDispatchQueue = function(callback) {
    i--;
    this._dispatcher.dispatch(callback);
  };

  var dispatchQueue = Async.queue(processDispatchQueue, this._options.limit);

  var queueNext = function(err) {
    if(err) {
      console.log(err);
    } else if(err === null) {
      i++;
      this._dispatcher._get(function(err, audit) {
        dispatchQueue.push(audit, queueNext);
      });
    }
  }

  while(i < this._options.limit) {
    queueNext(null);
  }
};

module.exports = AuditQueueWorker;
