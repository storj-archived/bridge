#!/usr/bin/env node

/**
 * @module metadisk
 */

'use strict';

const Config = require('../lib/config');
const Engine = require('../lib/engine');

module.exports = Engine(Config(process.env.NODE_ENV || 'devel')).start();
