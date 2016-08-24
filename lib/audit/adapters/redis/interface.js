'use strict';

const assert = require('assert');
const inherits = require('util').inherits;
const redis = require('redis');
const queue = require('./queue');
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
  this.redisQueue = new queue(adapter);
  this.subscriber = redis.createClient(adapter);
  this.subscriber.subscribe(
    this.redisQueue.rKeys.pass,
    this.redisQueue.rKeys.fail
  );

  this.subscriber.on('message', function(channel, message) {
    if(channel === this.redisQueue.rKeys.pass) {
      this.passHandler(message);
    } else if(channel === this.redisQueue.rKeys.fail) {
      this.failHandler(message);
    }
  }.bind(this));
};

RedisInterface.prototype.add = function(audits, callback) {
  this.redisQueue.add(audits, callback);
};

RedisInterface.prototype.createAuditJobs = function(opts) {
  AbstractAuditInterface.prototype.createAuditJobs.call(this, opts);
  var auditJobs = [];
  var duration = opts.end - opts.start;
  console.log(opts)
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
