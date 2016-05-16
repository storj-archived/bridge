#!/usr/bin/env node

'use strict';

const Config   = require('../config').audits;
const fork     = require('child_process').fork;
const numCores = require('os').cpus().length;
const argv     = require('minimist')(process.argv.slice(2));
const workers  = argv.workers;
const offset   = argv.offset;
const Auditor  = '../lib/audit';

const AuditService = function() {
  var workers = [];
  var options = [Config.limit, Config.frequency];
  this.offset = offset || 0;
  this.workers = workers || numCores - this.offset;

  console.log('Master forking ' + numCores + ' workers...');
  for(let i = 0; i < this.workers; i++) {
    workers[i] = fork(Auditor, options);

    workers[i].on('exit', function(code, signal) {
      console.log('Worker: ' + workers[i].pid + ' died with code: ' + code + ', and signal: ' + signal);
      console.log('restarting worker...');
      workers[i].fork(Auditor, options);
    });

    workers[i].on('error', function(err) {
      console.log(err);
    });
  }
}

module.exports = AuditService;
