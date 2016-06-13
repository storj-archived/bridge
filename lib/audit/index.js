'use strict';

const Verification = require('storj').Verification;
const Storage = require('../storage');
const config = JSON.parse(process.argv[2]);
//const Config = require('../config')(process.env.NODE_ENV || 'devel');
const Network = require('../network');
const AuditQueue = require('./queue.js');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - ceiling of simultaneous outgoing requests
 */
const AuditDispatchService = function(options) {
  var self = this;
  this._options = options;
  this._queue = new AuditQueue(this._options.redis);
  this._maxConcurrentRequests = options.limit;

  this.dispatch();
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

/**
 * Dispatches an Audit request
 * @param {Function} callback
 */
AuditDispatchService.prototype.dispatch = function() {
  this._queue.popReadyQueue(function(err, audit) {
    console.log(err);
    console.log(audit);

  });

  this.audit.pop(0, currTime, this._config.limit, function(err, result) {

    if(!result || result.length === 0) return;
    result.forEach(function(elem, ind, arr) {
      result[ind] = JSON.parse(elem);
      this.network.getStorageProof(
        result[ind].id,
        result[ind].hash,
        result[ind].challenge,
        this.handleAuditRequest
      );
    });
  });
};

AuditDispatchService.prototype.handleAuditRequest = function(err, proof) {
  if(err) {
    log.error(err.message);
    return;
  }
  var verification = new Verification(proof);
  verification.verify();


};

new AuditDispatchService(config);

//module.exports = AuditDispatchService;

//dispatch service, exposed in bin, accepts (a number of child processes || default: all available cpu cores || offset: max minus offset). Instantiates it's own connection to redis.




/*
const Dispatcher = require('./dispatcher');
const config = JSON.parse(process.argv[2]);

const AuditScheduler = function(options) {
  this.auditService = new Dispatcher(options);
  this.start();
}

AuditScheduler.prototype.start = function() {
  this.interval = setInterval(
    this.auditService.dispatch.bind(this.auditService),
    config.frequency
  );
}

AuditScheduler.prototype.stop = function() {
  clearInterval(this.interval);
}

new AuditScheduler(config);
*/
