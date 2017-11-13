#!/usr/bin/env node

'use strict';

const async = require('async');
const program = require('commander');
const Config = require('../lib/config');
const StorageEventsCron = require('../lib/cron/storage-events');

program.version(require('../package').version);
program.option('-c, --config <path_to_config_file>', 'path to the config file');
program.option('-d, --datadir <path_to_datadir>', 'path to the data directory');
program.parse(process.argv);

var config = new Config(process.env.NODE_ENV || 'develop', program.config, program.datadir);

var jobs = [
  new StorageEventsCron(config)
];

async.eachSeries(jobs, function(job, next) {
  job.start(next);
}, function(err) {
  if (err) {
    throw err;
  }
});
