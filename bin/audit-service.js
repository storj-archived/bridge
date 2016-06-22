#!/usr/bin/env node

'use strict';

const Config = require('../lib/config')(process.env.NODE_ENV || 'devel').audits;
const log = require('../lib/logger');
const fork = require('child_process').fork;
//const numCores = require('os').cpus().length;
//const argv     = require('minimist')(process.argv.slice(2));
const INTERVAL = 10000;
const Auditor = './lib/audit';
const AuditQueue = require('../lib/audit/queue.js');

const AuditService = function(options) {
  var self = this;
  this._options = options;
  this._workers = {};
  log.info('master audit service forking ' + this._options.workers.length + ' workers...');

  this._masterPollQueue = new AuditQueue(this._options.redis);
  console.log(this._masterPollQueue.populateReadyQueue)
  this._interval = setInterval(this.pollBacklog.bind(this), INTERVAL);

  this._options.workers.forEach(function(workerConfig, ind) {
    self.addNewWorkerToQueue(workerConfig);
  });
};

AuditService.prototype.addNewWorkerToQueue = function(workerConfig) {
  var self = this;
  var opts = Object.assign(workerConfig, {redis: this._options.redis});
  var newWorker = fork(Auditor, [JSON.stringify(opts)]);

  log.info('starting worker pid: ' + newWorker.pid);
  this._workers[newWorker.pid] = newWorker;

  this._workers[newWorker.pid].on('exit', function(code, signal) {
    delete self._workers[this.pid];
    log.info('worker pid:' + this.pid + ' exited with code: ' + code + ', signal: ' + signal);
    self.addNewWorkerToQueue(opts);
  });

  this._workers[newWorker.pid].on('error', function(err) {
    log.error(err);
  });
};

AuditService.prototype.pollBacklog = function() {
  var currTime = Math.floor(new Date() / 1000);
  this._masterPollQueue.populateReadyQueue(
    0,
    currTime,
    function(err, hasAudits) {
      if(err) log.error(err);
  });
}

new AuditService(Config);
