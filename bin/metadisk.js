#!/usr/bin/env node

/**
 * @module metadisk
 */

'use strict';

var Config = require('../lib/config');
var Engine = require('../lib/engine');

module.exports = Engine(Config(process.argv[2])).start();
