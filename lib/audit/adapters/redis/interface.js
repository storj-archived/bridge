'use strict';

const assert = require('assert');
const inherits = require('util').inherits;
const redis = require('redis');
const Queue = require('./queue');
const AbstractAuditInterface = require('../../abstractauditinterface');

inherits(RedisInterface, AbstractAuditInterface);

/**
 * Creates an new external audit interface
 * @constructor
 * @extends {AbstractAuditInterface}
 */

function RedisInterface(adapter) {
  AbstractAuditInterface.call(this, adapter);
  if(adapter.type) {
    delete adapter.type;
  }

  this.adder = redis.createClient(adapter);
  this.subscriber = redis.createClient(adapter);
  this.subscriber.subscribe(
    Queue.sharedKeys.pass,
    Queue.sharedKeys.fail
  );

  this.subscriber.on('message', function(channel, message) {
    if(channel === Queue.sharedKeys.pass) {
      this.passHandler(JSON.parse(message));
    } else if(channel === Queue.sharedKeys.fail) {
      this.failHandler(JSON.parse(message));
    }
  }.bind(this));
};


/**
 * Adds a series of Audits to the backlog queue
 * @param {Object[]} audits
 * @param {Number} audits[].ts - The Audit's scheduled time
 * @param {Object} audits[].data - Data required to fulfill the audit
 * @param {Object} audits[].data.id - Renter's shard contract primary key
 * @param {Object} audits[].data.root - Merkle root
 * @param {Object} audits[].data.depth - Merkle depth
 * @param {Object} audits[].data.challenge - Audit Challenge
 * @param {Object} audits[].data.hash - Hash of the consigned data
 * @param {AuditQueue~add} callback
 */

/**
 * Callback used by add.
 * @callback AuditQueue~add
 * @param {Error} err - Error
 * @param {Number} count - An integer of audits added to the backlog.
 **/

RedisInterface.prototype.add = function(audits, callback) {
  var command = [Queue.sharedKeys.backlog];
  audits.forEach(function(elem, ind) {
    command.push(elem.ts, JSON.stringify(elem.data));
  });

  this.adder.ZADD(command, function(err, resp) {
    if(err) return callback(err);
    this.adder.publish(
      Queue.sharedKeys.backlog,
      JSON.stringify(audits)
    );
    return callback(null, resp);
  }.bind(this));
};

RedisInterface.prototype.createAuditJobs = function(opts) {
  AbstractAuditInterface.prototype.createAuditJobs.call(this, opts);
  var auditJobs = [];
  var duration = opts.end - opts.start;

  opts.challenges.forEach(function(challenge, ind) {
    var auditJob = {
      ts: opts.start + ( duration * (ind / opts.challenges.length) ),
      data: {
        id: opts.farmer,
        root: opts.root,
        depth: opts.depth,
        challenge: challenge,
        hash: opts.hash
      }
    };

    auditJobs.push(auditJob);
  });

  return auditJobs;
};


module.exports = RedisInterface;
