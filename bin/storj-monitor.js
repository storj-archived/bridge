#!/usr/bin/env node

'use strict';

const program = require('commander');
const Config = require('../lib/monitor/config');
const Monitor = require('../lib/monitor');

program.version(require('../package').version);
program.option('-c, --config <path_to_config_file>', 'path to the config file');
program.parse(process.argv);

var config = new Config(program.config);
var monitor = new Monitor(config);

monitor.start(function(err) {
  if (err) {
    console.log(err);
  }
});

module.exports = monitor;
