'use strict';

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const merge = require('merge');
const url = require('url');
const _ = require('lodash');

const ENV = process.env;
const PLATFORM = os.platform();
const DIRNAME = '.storj-bridge';
const HOME = PLATFORM === 'win32' ? ENV.USERPROFILE : ENV.HOME;
const STORJ_BRIDGE_PATH = ENV.STORJ_BRIDGE_DIR || HOME;
const DATADIR = path.join(STORJ_BRIDGE_PATH, DIRNAME);
const CONSTANTS = require('./constants');

const MONGO_URL = process.env.MONGO_URL || ('mongodb://127.0.0.1:27017/__storj-bridge-' + process.env.NODE_ENV || 'development');
const MONGO_URL_OBJ = url.parse(MONGO_URL);
const MONGO_USERNAME = MONGO_URL_OBJ.auth && MONGO_URL_OBJ.auth.split(':')[0];
const MONGO_PASSWORD = MONGO_URL_OBJ.auth && MONGO_URL_OBJ.auth.split(':')[1];
const MONGOS = process.env.MONGOS && JSON.parse(process.env.MONGOS);
const MONGO_SSL = process.env.MONGO_SSL && JSON.parse(process.env.MONGO_SSL);
const EXPRESS_PORT = process.env.EXPRESS_PORT && parseInt(process.env.EXPRESS_PORT, 10);


const ENV_OVERRIDES = {
  storage: {
    mongoURI: MONGO_URL,
    mongoOptions: {
      ssl : MONGO_SSL,
      auth: {
        user: process.env.MONGO_USERNAME || MONGO_USERNAME,
        pass: process.env.MONGO_PASSWORD || MONGO_PASSWORD
      },
      mongos: MONGOS
    }
  },
  server: {
    port: EXPRESS_PORT
  }
};

const DEFAULTS = {
  application: {
    mirrors: 6,
    privateKey: null
  },
  storage: {
    mongoURI: 'mongodb://127.0.0.1:27017/__storj-bridge-' + (process.env.NODE_ENV || 'develop'),
    mongoOptions: {
      auth: {
        user: null,
        pass: null
      },
      mongos: false,
      ssl: false
    }
  },
  server: {
    host: '127.0.0.1',
    port: 6382,
    timeout: 240000,
    ssl: {
      cert: null,
      key: null,
      ca: [],
      redirect: 80
    },
    public: {
      host: '127.0.0.1',
      port: 80
    }
  },
  complex: {
    rpcUrl: 'http://localhost:8080',
    rpcUser: 'user',
    rpcPassword: 'pass'
  },
  logger: {
    level: CONSTANTS.LOG_LEVEL_INFO
  },
  mailer: {
    host: '127.0.0.1',
    port: 465,
    secure: true,
    auth: {
      user: 'username',
      pass: 'password'
    },
    from: 'robot@storj.io'
  }
};

function getPaths(env, confpath, datadir) {
  var paths = {};
  if (datadir) {
    assert(path.isAbsolute(datadir), 'datadir is expected to be absolute');
    paths.datadir = datadir;
  } else {
    paths.datadir = DATADIR;
  }
  if (confpath) {
    assert(path.isAbsolute(confpath), 'confpath is expected to be absolute');
    paths.confdir = path.dirname(confpath);
    paths.confpath = confpath;
  } else {
    paths.confdir = path.join(paths.datadir, 'config');
    assert(env, 'env is expected without config path');
    paths.confpath = path.join(paths.confdir, env);
  }
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

function setupDataDirectory(paths) {
  if (!fs.existsSync(paths.datadir)) {
    fs.mkdirSync(paths.datadir);
  }
  var itemdir = path.join(paths.datadir, 'items');
  if (!fs.existsSync(itemdir)) {
    fs.mkdirSync(itemdir);
  }
}

/**
 * Represents a configuration
 * @constructor
 * @param {String|Object} arg
 */
function Config(env, confpath, datadir) {
  if (!(this instanceof Config)) {
    return new Config(env, confpath, datadir);
  }

  var config;

  if (typeof env === 'string') {

    var paths = Config.getPaths(env, confpath, datadir);
    Config.setupDataDirectory(paths);
    Config.setupConfig(paths);

    const reduceConfig = function (result, overrideValue, overrideKey) {
      if (overrideValue != null && typeof(overrideValue) === 'object') {
        result[overrideKey] = _.reduce(overrideValue, reduceConfig, {});
      } else if (overrideValue !== null && typeof(overrideValue) !== 'undefined') {
        result[overrideKey] = overrideValue;
      }
      return result;
    };
    const configEnvOverrides = _.reduce(ENV_OVERRIDES, reduceConfig, {});

    config = merge.recursive(
      DEFAULTS,
      JSON.parse(fs.readFileSync(paths.confpath)),
      configEnvOverrides
    );

  } else {
    config = merge(Object.create(DEFAULTS), env);
  }

  for (let prop in config) {
    this[prop] = config[prop];
  }

}

Config.DEFAULTS = DEFAULTS;
Config.setupDataDirectory = setupDataDirectory;
Config.setupConfig = setupConfig;
Config.getPaths = getPaths;

module.exports = Config;
