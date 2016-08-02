'use strict';

const assert = require('assert');
const inherits = require('util').inherits;
const redis = require('redis');
const queue = require('./queue');
const AuditInterface = require('../../auditinterface');

inherits(RedisInterface, AuditInterface);

function RedisInterface(adapter) {
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

/**
 * getJobsFromStorageItem
 * @param {String} key -
 * @param {StorageItem} item -
 */

RedisInterface.prototype.getJobsFromStorageItem = function(key, item) {
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


module.exports = RedisInterface;
