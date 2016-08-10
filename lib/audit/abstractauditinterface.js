'use strict';

const assert = require('assert');
const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

inherits(AbstractAuditInterface, EventEmitter);

/**
 * Abstract external interface for audits
 * @constructor
 */

function AbstractAuditInterface(adapter) {
  this.Events = {
    pass: 'audit.full.pass',
    fail: 'audit.full.fail'
  };

  this.setMaxListeners(Infinity);
}

/**
 * abstract class to add audits to the storage adapter
 * @param {Object[]} audits
 * @param {Number} audits[].ts - The Audit's scheduled time
 * @param {Object} audits[].data - Data required to fulfill the audit
 * @param {Object} audits[].data.id - Renter's shard contract primary key
 * @param {Object} audits[].data.root - Merkle root
 * @param {Object} audits[].data.depth - Merkle depth
 * @param {Object} audits[].data.challenge - Audit Challenge
 * @param {Object} audits[].data.hash - Hash of the consigned data
 * @param {AbstractAuditInterface~add} callback
 */

 /**
  * Callback used by add.
  * @callback AbstractAuditInterface~add
  * @param {Error} err - Error
  * @param {Number} count - An integer of audits added.
  */


AbstractAuditInterface.prototype.add = function(audits, callback) {
  throw new Error('Method not implemented');
}

/**
 * creates an AuditJob from a StorageItem
 * @param {String} key - a node ID
 * @param {StorageItem} item - an instance of StorageItem
 */

AbstractAuditInterface.prototype.createJobFromStorageItem = function(key, item) {
  assert(item instanceof storj.StorageItem);
  if(!item.contracts[key] || !item.challenges[key]) {
    return null;
  }
}

/**
 * abstract event handler for passed audit
 * @param {AuditJob} audit - an instance of AuditJob
 */

AbstractAuditInterface.prototype.passHandler = function(audit) {
  this.emit(this.Events.pass, audit);
};

/**
 * abstract event handler for failed audit
 * @param {AuditJob} audit - an instance of AuditJob
 */

AbstractAuditInterface.prototype.failHandler = function(audit) {
  this.emit(this.Events.fail, audit);
};

module.exports = AbstractAuditInterface;
