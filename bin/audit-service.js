#!/usr/bin/env node

'use strict';

const Config   = require('../lib/config')(process.env.NODE_ENV || 'devel').audits;
const log      = require('../lib/logger');
const fork     = require('child_process').fork;
//const numCores = require('os').cpus().length;
//const argv     = require('minimist')(process.argv.slice(2));
const Auditor  = './lib/audit';

const AuditService = function() {
  const numWorkers = Config.length;
  var workers      = {};

  log.info('master audit service forking ' + numWorkers + ' workers...');

  for(let i = 0; i < numWorkers; i++) {
    let options = [
      Config[i].limit,
      Config[i].frequency,
      JSON.stringify(Config[i].redis),
      JSON.stringify(Config[i].network)
    ];
    workers = addNewWorkerToQueue(workers, Auditor, options);
  }

  function addNewWorkerToQueue(queue, module, opts) {
    var newWorker = fork(module, opts);
    log.info('starting worker pid: ' + newWorker.pid);
    queue[newWorker.pid] = newWorker;

    queue[newWorker.pid].on('exit', function(code, signal) {
      delete queue[this.pid];
      log.info('worker pid:' + this.pid + ' exited with code: ' + code + ', signal: ' + signal);
      addNewWorkerToQueue(queue);
    });

    queue[newWorker.pid].on('error', function(err) {
      log.error(err);
    });

    return queue;
  }
}

module.exports = AuditService();
