'use strict';

const assert = require('assert');
const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

inherits(AuditInterface, EventEmitter);

function AuditInterface(adapter) {
  this.Events = {
    pass: 'audit.full.pass',
    fail: 'audit.full.fail'
  };
}

AuditInterface.setMaxListeners(Infinity);

AuditInterface.prototype.add = function(audits, callback) {
  throw new Error('Method not implemented');
}

AuditInterface.prototype.createJobFromStorageItem = function(key, item) {
  throw new Error('Method not implemented');
}

AuditInterface.prototype.passHandler = function(audit) {
  this.emit(this.Events.pass, audit);
};

AuditInterface.prototype.failHandler = function(audit) {
  this.emit(this.Events.fail, audit);
};

module.exports = AuditInterface;
