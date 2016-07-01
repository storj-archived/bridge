#!/usr/bin/env node

'use strict';

const log = require('../../lib/logger');
const fork = require('child_process').fork;
const Auditor = './lib/audit/worker.js';
const AuditQueue = require('../../lib/audit/queue.js');

const AuditService = function(options) {
  var self = this;
  this._options = options;
  this._workers = {};
  log.info('master audit service forking '
    + this._options.workers.length + ' workers...'
  );

  if(this._options.polling !== undefined) {
    this._masterPollQueue = new AuditQueue(this._options.redis, 'master');
    this.pollBacklog();

    this._interval = setInterval(
      this.pollBacklog.bind(this, this._options.polling.padding),
      this._options.polling.interval
    );
  }

  this._options.workers.forEach(function(workerConfig, ind) {
    self.addNewWorkerToQueue(workerConfig);
  });
};

AuditService.prototype.addNewWorkerToQueue = function(workerConfig) {
  var self = this;
  var opts = Object.assign(workerConfig, {redis: this._options.redis});

  log.info('starting worker uuid: ' + opts.uuid);
  this._workers[opts.uuid] = fork(Auditor, [JSON.stringify(opts)]);

  this._workers[opts.uuid].on('exit', function(code, signal) {
    delete self._workers[opts.uuid];
    log.info('worker uuid:' + opts.uuid
      + ' exited with code: ' + code
      + ', signal: ' + signal
    );
    self.addNewWorkerToQueue(opts);
  });

  this._workers[opts.uuid].on('error', function(err) {
    log.error(err);
  });
};

AuditService.prototype.pollBacklog = function(timePadding) {
  var currTime = Math.floor(new Date() / 1000) + timePadding;
  this._masterPollQueue.populateReadyQueue(
    0,
    currTime,
    function(err, hasAudits) {
      if(err) log.error(err);
  });
}

module.exports = AuditService;
