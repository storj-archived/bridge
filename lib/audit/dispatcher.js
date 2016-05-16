const storj      = require('storj');
const Storage    = require('../storage');
const Config     = require('../config');
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

  let netopts = merge(Object.create(Config.network), {
    storage: new Storage(Config.storage)
  });

  Network.createInterface(netopts, function(err, network) {
    if(err) {
      console.log('failed to connect to storj network, reason: ' + err.message);
    }
    self.network = network;
    self.audit = new AuditQueue(self._config.audit);
  });
}

/**
 * Dispatches an Audit request
 * @param {Function} callback
 */
AuditDispatchService.prototype.dispatch = function(callback) {
  let currTime = Math.floor(new Date() / 1000);
  this.audit.pop(0, currTime, function(err, result) {
    result.forEach(function(elem, ind, arr) {
      result[ind] = JSON.parse(elem);
    });
    console.log(result);
    result = JSON.parse(result);
    this.network.getStorageProof(result.id, result.hash, result.challenge, callback);
  });
};

module.exports = AuditDispatchService;

//dispatch service, exposed in bin, accepts (a number of child processes || default: all available cpu cores || offset: max minus offset). Instantiates it's own connection to redis.
