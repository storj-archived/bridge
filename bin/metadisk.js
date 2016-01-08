#!/usr/bin/env node

/**
 * @module metadisk
 */

'use strict';

const Config = require('../lib/config');
const Engine = require('../lib/engine');

module.exports = Engine(Config(process.argv[2])).start();
