'use strict';

const Verification = require('storj').Verification;
const log = require('../logger');

/**
 * Audit Dispatch Service
 * @constructor
 * @param {Object} options - Dispatch service options
 * @param {Object} options.limit - ceiling of simultaneous outgoing requests
 */
const AuditDispatcher = function(queue, network) {
  var self = this;
  this._queue = queue;
  this._network = network;
};

/**
 * Dispatches an Audit request
 * @param {Function} callback

AuditDispatcher.prototype.dispatch = function(callback) {
  Async.waterfall([
    this._get,
    this._verify,
    this._commit
  ],
  function done(err, result) {
    if(err) return callback(err);
    return callback(null, result);
  });
};
*/
AuditDispatcher.prototype._get = function(callback) {
  this._queue.popReadyQueue(function(err, audit) {
    if(err) return callback(err);
    var audit = JSON.parse(audit);
    return callback(null, audit);
  });
};

AuditDispatcher.prototype._verify = function(audit, callback) {
  this._network.getStorageProof(
    audit.id,
    audit.hash,
    audit.challenge,
    function getProofResult(err, proof) {
      if(err) return callback(err);
      var verification = new Verification(proof);
      var result = verification.verify(audit.root, audit.depth)
      var hasPassed = result[0] === result[1];
      return callback(null, audit, hasPassed);
    });
};

AuditDispatcher.prototype._commit = function(audit, hasPassed, callback) {
  this._queue.pushResultQueue(audit, hasPassed, function(err, isSuccess) {
    if(err) return callback(err);
    return callback(null, isSuccess);
  });
};

module.exports = AuditDispatcher;
