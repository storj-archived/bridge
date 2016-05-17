'use strict';

const Dispatcher = require('./dispatcher');
const limit      = process.argv[2];
const frequency  = process.argv[3];
/**
 * Audit Scheduler
 * @constructor
 */
const AuditScheduler = function() {
  this.auditService = new Dispatcher({limit: limit});
  this.start();
}

AuditScheduler.prototype.stop = function() {
  clearInterval(this.interval);
}

AuditScheduler.prototype.start = function() {
  this.interval = setInterval(this.auditService.dispatch.bind(this.auditService), frequency);
}

module.exports = new AuditScheduler();
