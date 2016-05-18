'use strict';

const Dispatcher = require('./dispatcher');
const config = {
  limit     : process.argv[2],
  frequency : process.argv[3],
  redis     : JSON.parse(process.argv[4]),
  network   : JSON.parse(process.argv[5])
};
/**
 * Audit Scheduler
 * @constructor
 */
const AuditScheduler = function() {
  this.auditService = new Dispatcher(config);
  this.start();
}

AuditScheduler.prototype.start = function() {
  this.interval = setInterval(
    this.auditService.dispatch.bind(this.auditService),
    config.frequency
  );
}

AuditScheduler.prototype.stop = function() {
  clearInterval(this.interval);
}

module.exports = new AuditScheduler();
