'use strict';

const redis = require('redis');
const async = require('async');
const PRIMARY = 0;
const LASTAUDIT = 1;

/**
 * An interface to the Audit queue
 * @constructor
 * @param {Object} config - Redis client configuration
 */
const Audit = function(config) {
  this._config = config;
  this.setName = 'auditschedule';
  this.finalSetName = 'finalauditschedule';

  this.client = redis.createClient(this._config);
  //this.client.auth(this._config.pass, handleError);
  this.client.on('error', handleError);

  function handleError(err) {
    if(err) throw err;
  }
};

/**
 * Adds a series of Audits to the queue
 * @param {Object[]} audits
 * @param {Number} audits[].ts - The Audit's scheduled time
 * @param {Boolean} audits[].isFinal - Audit is last before contract expiry
 * @param {Object} audits[].data - Data required to fulfill the audit
 * @param {Object} audits[].data.challenge - Audit Challenge
 * @param {Object} audits[].data.hash - Hash of the consigned data
 * @param {Object} audits[].data.id - Renter's shard contract primary key
 * @param {Function} callback
 */
Audit.prototype.add = function(audits, callback) {
  let command = [this.setName, 'NX']; //NX: no updates, only additions
  let finalCommand = [this.finalSetName, 'NX']; //NX: no updates, only additions

  audits.forEach(function(elem, ind) {
    if(elem.isFinal) {
      return finalCommand.push(elem.ts, JSON.stringify(elem.data));
    }
    command.push(elem.ts, JSON.stringify(elem.data));
  });

  async.parallel([
    function(next) {
      this.client.ZADD(command, function(err, resp) {
        if(err) return next(err);
        return next(null, resp);
      });
    },
    function(next) {
      this.client.ZADD(finalCommand, function(err, resp) {
        if(err) return next(err);
        return next(null, resp);
      });
    }
  ],function done(err, results) {
    if(err) return calback(err);
    return callback(null, results);
  });
};

/**
 * Returns all elements in the Audit queue for a given time range
 * @param {Number} start - Time, in seconds, to begin search
 * @param {Number} stop - Time, in seconds, to end search
 * @param {Function} callback
 */
Audit.prototype.pop = function(start, stop, limit, callback) {
  start = start || 0;
  stop = stop || Math.floor(new Date() / 1000);
  let command = [this.setName, start, stop, 'LIMIT', 0, limit];

  this.client.ZRANGEBYSCORE(command, function(err, resp) {
    if(err) return callback(err);
    return callback(null, resp);
  });
};

/**
 * Removes a series of Audits from the queue
 * @param {Object[]} audits
 * @param {Object} audits[].challenge - Audit Challenge
 * @param {Object} audits[].hash - Hash of the consigned data
 * @param {Object} audits[].id - Renter's shard contract primary key
 * @param {Function} callback
 */
Audit.prototype.remove = function(audits, callback) {
  let command = [];

  audits.forEach(function(elem) {
    command.push(elem)
  });

  this.client.ZREM(command, function(err, resp) {
    if(err) return callback(err);
    return callback(null, resp);
  });
};

module.exports = Audit;
