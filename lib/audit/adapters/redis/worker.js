'use strict';

const AuditDispatchQueueWorker = require('./auditqueueworker');
const config = JSON.parse(process.argv.slice(2));

new AuditDispatchQueueWorker(config);
