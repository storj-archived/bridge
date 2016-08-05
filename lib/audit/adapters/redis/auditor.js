'use strict';

const Async = require('async');
const Verification = require('storj').Verification;
const log = require('../../../../lib/logger');
const AuditQueue = require('./queue.js');

/**
 * RedisAuditor Service
 * @constructor
 * @param {Object} queue - storage queue for scheduled audits
 * @param {Object} network - renter interface
 */

function RedisAuditor(network, redisconfig, uuid) {
  this._queue = new AuditQueue(redisconfig, uuid);
  this._network = network;
};

RedisAuditor.prototype.get = function(callback) {
  this._queue.popReadyQueue(function(err, audit) {
    if(err) return callback(err);
    var audit = JSON.parse(audit);
    return callback(null, audit);
  });
};

RedisAuditor.prototype.verify = function(audit, callback) {
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

RedisAuditor.prototype.commit = function(audit, hasPassed, callback) {
  this._queue.pushResultQueue(audit, hasPassed, function(err, isSuccess) {
    if(err) return callback(err);
    return callback(null, isSuccess);
  });
};

RedisAuditor.prototype.process = function(audit, nextAudit) {
  Async.waterfall([
   Async.apply(this.verify, audit),
   this.commit
  ], function done(err) {
   if(err) logger.error(err);
   return nextAudit();
  });
};

RedisAuditor.prototype.getPendingQueue = function(callback) {
  return this._queue.getPendingQueue(callback);
};

module.exports = RedisAuditor;
