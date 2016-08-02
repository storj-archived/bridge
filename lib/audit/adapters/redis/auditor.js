'use strict';

const inherits = require('util').inherits;
const Async = require('async');
const Verification = require('storj').Verification;
const log = require('../../../../lib/logger');
const assert = require('assert');
const storj = require('storj');
const AuditQueue = require('./queue.js');

/**
 * RedisAuditor Service
 * @constructor
 * @param {Object} queue - storage queue for scheduled audits
 * @param {Object} network - renter interface
 */
const RedisAuditor = function(queue, network) {
  var self = this;
  this._queue = new AuditQueue(this._options.redis, this._options.uuid);
  this._network = network;
};
/*
RedisAuditor.prototype.add = function(audits, callback) {
  assert(Array.isArray(audits));
  this._queue.add(audits, callback);
};
*/
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
}

/**
 * getJobsFromStorageItem
 * @param {String} key -
 * @param {StorageItem} item -
 */

RedisAuditor.getJobsFromStorageItem = function(key, item) {
  assert(item instanceof storj.StorageItem);
  assert(item.contracts[key]);
  assert(item.challenges[key]);

  var auditJobs = [];
  var eTime = item.contracts[key].start_time;
  var sTime = item.contracts[key].end_time;
  var duration = eTime - sTime;

  item.challenges[key].challenges.forEach(function(challenge, ind) {
    let auditJob = {
      ts: sTime + ( duration * (ind / item.challenges[key].length) ),
      data: {
        id: key,
        root: item.challenges[key].root,
        depth: item.challenges[key].depth,
        challenge: item.challenges[key].challenges,
        hash: item.hash //item.trees[key]
      }
    };

    auditJobs.push(auditJob);
  });

  return auditJobs;
};

module.exports = RedisAuditor;
