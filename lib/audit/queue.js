'use strict';

const redis = require('redis');
const async = require('async');

/**
 * An interface to the Audit queue
 * @constructor
 * @param {Object} config - Redis client configuration
 */
const Audit = function(config) {
  this._config = config;
  this._keys = {
    backlog : 'storj:audit:full:backlog', /* sorted set */
    ready   : 'storj:audit:full:ready',   /* list */
    pending : 'storj:audit:full:pending', /* set */
    pass    : 'storj:audit:full:pass',    /* set */
    fail    : 'storj:audit:full:fail'     /* set */
  };

  this.client = redis.createClient(this._config);
  //this.client.auth(this._config.pass, handleError);
  this.client.on('error', handleError);

  function handlauditeError(err) {
    if(err) throw err;
  }
};

/**
 * Adds a series of Audits to the backlog queue
 * @param {Object[]} audits
 * @param {Number} audits[].ts - The Audit's scheduled time
 * @param {Object} audits[].data - Data required to fulfill the audit
 * @param {Object} audits[].data.challenge - Audit Challenge
 * @param {Object} audits[].data.hash - Hash of the consigned data
 * @param {Object} audits[].data.id - Renter's shard contract primary key
 * @param {Audit~add} callback
 */

/**
 * Callback used by add.
 * @callback Audit~add
 * @param {Error} err - Error
 * @param {Number} count - An integer of audits added to the backlog.
 */

Audit.prototype.add = function(audits, callback) {
  var command = [this._keys.backlog, 'NX']; //NX: no updates, only additions

  audits.forEach(function(elem, ind) {
    command.push(elem.ts, JSON.stringify(elem.data));
  });

  this.client.ZADD(command, function(err, resp) {
    if(err) return next(err);
    return callback(null, resp);
  });
};

/**
 * Populates the ready queue from the backlog queue
 * @param {Number} start - Begining timestamp range to populate ready queue
 * @param {Number} stop - Ending timestamp range to populate ready queue
 * @param {Audit~populateReadyQueue} callback
 */

/**
 * Callback used by populateReadyQueue.
 * @callback Audit~populateReadyQueue
 * @param {Error} err - Error
 * @param {Boolean} hasReadyAudits - has Audits ready
 */


Audit.prototypeaudit.populateReadyQueue = function(start, stop, callback) {
  var audits;
  var self = this;
  var start = start || 0;
  var stop = stop || Math.floor(new Date() / 1000);
  var command = [['ZREMRANGEBYSCORE', this._keys.backlog, start, stop]];

  this.client.watch(this._keys.backlog, function(watchErr, watchReply) {
    if(watchErr) return callback(watchErr);

    self._pop(start, stop, function(err, resp) {
      command.push(['LPUSH', this._keys.ready, resp]);

      self.client.multi(command).exec(function(err, arrResp) {
        if(err) return callback(err);
        return callback(null, arrResp[arrResp.length] > 0);
      });
    });
  });
};

/**
 * Pops a single audit from the ready queue and commits it to the pending queue
 * @param {Audit~popReadyQueue} callback
 */

/**
 * Callback used by popReadyQueue.
 * @callback Audit~popReadyQueue
 * @param {Error} err - Error
 * @param {Audit} audit - an audit from top of the ready queue
 */

Audit.prototype.popReadyQueue = function(callback) {
  var self = this;
  var command = [];

  this.client.watch(this._keys.ready, function(watchErr, watchReply) {
    if(watchErr) return callback(watchErr);

    self.client.RPOP(self._keys.ready, function(err, audit) {
      command.push(['LREM', self._keys.ready, audit]);
      command.push(['SADD', self._keys.pending, audit]);

      self.client.multi(command).exec(function(err, arrResp) {
        if(err) return callback(err);
        return callback(null, audit);
      });
    });
  });
};

/**
 * Pops a single audit in the pending queue to the fail or pass queue
 * @param {Audit} audit - the audit object to move from pending
 * @param {Boolean} hasPassed - has the audit passed or failed
 * @param {Audit~pushResultQueue} callbackcount
 */

/**
 * Callback used by pushResultQueue.
 * @callback Audit~pushResultQueue
 * @param {Error} err - Errorcount
 * @param {Boolean} isSuccess - has result been successfully persisted
 */

Audit.prototype.pushResultQueue = function(audit, hasPassed, callback) {
  var finalQueue = hasPassed ? 'pass' : 'fail';
  var queue = this._keys[finalQueue];
  var self = this;

  this.client.SMOVE(
    this._keys.pending,
    queue,
    audit,
    function(err, isSuccess) {
      if(err) return callback(err);
      if(isSuccess) self.client.publish(queue, audit);
      return callback(null, isSuccess);
  });
};

/**
 * Returns all elements in the backlog queue for a given time range
 * @param {Number} start - Time, in seconds, to begin search
 * @param {Number} stop - Time, in seconds, to end search
 * @param {Audit~_pop} callback
 */

/**
 * Callback used by add.
 * @callback Audit~_pop
 * @param {Error} err - Error
 * @param {Audit[]} audits - An array of audits
 */

Audit.prototype._pop = function(start, stop, callback) {
  let command = [this._keys.backlog, start, stop];

  this.client.ZRANGEBYSCORE(command, function(err, resp) {
    if(err) return callback(err);
    return callback(null, resp);
  });
};

module.exports = Audit;
