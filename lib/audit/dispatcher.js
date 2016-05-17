'use strict';

const storj      = require('storj');
const Storage    = require('../storage');
const Config     = require('../config')(process.env.NODE_ENV || 'devel');
const Network    = require('../network');
const AuditQueue = require('./queue.js');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - ceiling of possible simultaneous outgoing requests
 */
const AuditDispatchService = function(options) {
  const self = this;
  this.limit = options.limit;

  let netopts = Object.assign(Object.create(Config.network), {
    storage: new Storage(Config.storage)
  });

  Network.createInterface(netopts, function(err, network) {
    if(err) {
      console.log('failed to connect to storj network, reason: ' + err.message);
    }
    self.network = network;
    self.audit = new AuditQueue(Config.audits);
  });
}

/**
 * Dispatches an Audit request
 * @param {Function} callback
 */
AuditDispatchService.prototype.dispatch = function(callback) {
  let currTime = Math.floor(new Date() / 1000);
  this.audit.pop(0, currTime, Config.audits.limit, function(err, result) {
    console.log(result);
    if(!result || result.length === 0) return;
    result.forEach(function(elem, ind, arr) {
      result[ind] = JSON.parse(elem);
      this.network.getStorageProof(
        result[ind].id,
        result[ind].hash,
        result[ind].challenge,
        callback
      );
    });
  });
};

module.exports = AuditDispatchService;

//dispatch service, exposed in bin, accepts (a number of child processes || default: all available cpu cores || offset: max minus offset). Instantiates it's own connection to redis.
