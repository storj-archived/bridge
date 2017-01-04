'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const merge = require('merge');

const CONSTANTS = require('../constants');

const DEFAULT_DB = process.env.NODE_ENV || 'develop';

const DEFAULTS = {
  storage: {
    mongoUrl: `mongodb://127.0.0.1:27017/__storj-bridge-${DEFAULT_DB}`,
    mongoOpts: {}
  },
  complex: {
    rpcUrl: 'http://localhost:8080',
    rpcUser: 'user',
    rpcPassword: 'pass'
  },
  logger: {
    level: CONSTANTS.LOG_LEVEL_INFO
  },
  application: {
    maxInterval: '10m',
    minInterval: '5m',
    queryNumber: 100
  }
};

function getPaths(confpath) {
  var paths = {};
  assert(path.isAbsolute(confpath), 'confpath is expected to be absolute');
  paths.confdir = path.dirname(confpath);
  paths.confpath = confpath;
  return paths;
}

function setupConfig(paths) {
  if (!fs.existsSync(paths.confdir)) {
    fs.mkdirSync(paths.confdir);
  }
  if (!fs.existsSync(paths.confpath)) {
    fs.writeFileSync(paths.confpath, JSON.stringify(DEFAULTS, null, 2));
  }
}

/**
 * Represents a configuration
 * @constructor
 * @param {String|Object} arg
 */
function Config(confpath) {
  if (!(this instanceof Config)) {
    return new Config(confpath);
  }

  var paths = Config.getPaths(confpath);
  Config.setupConfig(paths);

  const config = merge.recursive(
    JSON.parse(JSON.stringify(DEFAULTS)),
    JSON.parse(fs.readFileSync(paths.confpath))
  );

  for (let prop in config) {
    this[prop] = config[prop];
  }

}

Config.DEFAULTS = DEFAULTS;
Config.setupConfig = setupConfig;
Config.getPaths = getPaths;

module.exports = Config;
