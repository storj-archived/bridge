#!/usr/bin/env node

'use strict';

const Config   = require('../lib/config')(process.env.NODE_ENV || 'devel').audits;
const log      = require('../lib/logger');
const fork     = require('child_process').fork;
const numCores = require('os').cpus().length;
const argv     = require('minimist')(process.argv.slice(2));
const Auditor  = './lib/audit';

const AuditService = function() {
  var offset     = argv.offset || 0;
  var numWorkers = argv.workers || numCores - offset;
  var workers    = {};
  var options    = [Config.limit, Config.frequency];

  log.info('Master forking ' + numWorkers + ' workers...');

  for(let i = 0; i < numWorkers; i++) {
    workers = addNewWorkerToQueue(workers);
  }

  function addNewWorkerToQueue(queue) {
    let newWorker = fork(Auditor, options);
    log.info('starting worker: ' + newWorker.pid);
    queue[newWorker.pid] = newWorker;

    queue[newWorker.pid].on('exit', function(code, signal) {
      delete queue[this.pid];
      log.info('Worker pid:' + this.pid + ' exited with code: ' + code + ', signal: ' + signal);
      addNewWorkerToQueue(queue);
    });

    queue[newWorker.pid].on('error', function(err) {
      log.error(err);
    });

    return queue;
  }
}

module.exports = AuditService();
