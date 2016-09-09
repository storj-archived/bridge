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
      this.passHandler(message);
    } else if(channel === Queue.sharedKeys.fail) {
      this.failHandler(message);
    }
  }.bind(this));
};

RedisInterface.prototype.add = function(audits, callback) {
  var command = [Queue.sharedKeys.backlog];
  audits.forEach(function(elem, ind) {
    command.push(elem.ts, JSON.stringify(elem.data));
  });

  this.adder.ZADD(command, function(err, resp) {
    if(err) return callback(err);
    return callback(null, resp);
  });
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
