const Dispatcher = require('./dispatcher');
const limit      = process.argv[2];
const frequency  = process.argv[3];
/**
 * Audit Scheduler
 * @constructor
 */
const AuditScheduler = function() {
  this.auditService = new Dispatcher({limit: limit});
  setTimeout(this.auditService.dispatch, frequency, function() {
    //callback
  });
}

module.exports = AuditScheduler;
