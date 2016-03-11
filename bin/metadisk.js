#!/usr/bin/env node

'use strict';

const Config = require('../lib/config');
const Engine = require('../lib/engine');

module.exports = Engine(Config(process.env.NODE_ENV || 'devel'));

module.exports.start(function(err) {
  if (err) {
    console.log(err);
  }
});
