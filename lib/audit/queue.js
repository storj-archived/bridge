'use strict';

const redis = require('redis');
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
 * @param {Object} audits[].data - Data required to fulfill the audit
 * @param {Object} audits[].data.challenge - Audit Challenge
 * @param {Object} audits[].data.hash - Hash of the consigned data
 * @param {Object} audits[].data.id - Renter's shard contract primary key
 * @param {Function} callback
 */
Audit.prototype.add = function(audits, callback) {
  let command = [this.setName];

  audits.forEach(function(elem, ind) {
    command.push(elem.ts, elem.data);
  });

  this.client.ZADD(command, function(err, resp) {
    if(err) return callback(err);
    return callback(null, resp);
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
