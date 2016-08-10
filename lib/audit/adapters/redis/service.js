#!/usr/bin/env node

'use strict';

const fork = require('child_process').fork;
const clone = require('merge').clone;
const log = require('../../../../lib/logger');
const Auditor = './lib/audit/adapters/redis/worker.js';
const AuditQueue = require('./queue.js');

function AuditService(options) {
  this._polling = (options.adapter.polling)
    ? clone(options.adapter.polling)
    : null;

  this._options = clone(options);
  delete this._options.adapter.polling;

  this._workers = {};

  log.info('master audit service forking '
    + this._options.workers.length + ' workers...'
  );

  if(this._polling !== null) {
    this._masterPollQueue = new AuditQueue(this._options.adapter, 'master');
    this.pollBacklog(this._polling.padding);

    this._interval = setInterval(
      this.pollBacklog.bind(this, this._polling.padding),
      this._polling.interval
    );
  }

  this._options.workers.forEach(function(workerConfig) {
    this.addNewWorkerToQueue(workerConfig);
  }.bind(this));
};

AuditService.prototype.addNewWorkerToQueue = function(workerConfig) {
  var opts = Object.assign(workerConfig, {redis: this._options.adapter});

  log.info('starting worker uuid: ' + opts.uuid);
  this._workers[opts.uuid] = fork(Auditor, [JSON.stringify(opts)]);

  this._workers[opts.uuid].on('exit', function(code, signal) {
    delete this._workers[opts.uuid];
    log.info('worker uuid:' + opts.uuid
      + ' exited with code: ' + code
      + ', signal: ' + signal
    );
    this.addNewWorkerToQueue(opts);
  }.bind(this));

  this._workers[opts.uuid].on('error', function(err) {
    log.error(err);
  });
};

AuditService.prototype.pollBacklog = function(timePadding) {
  var timePadding = timePadding || 0;
  var currTime = Math.floor(new Date() / 1000) + timePadding;

  this._masterPollQueue.populateReadyQueue(
    0,
    currTime,
    function(err, hasAudits) {
      if(err) log.error(err);
  });
}

module.exports = AuditService;
