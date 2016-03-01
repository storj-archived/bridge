/**
 * @class metadisk/config
 */

'use strict';

const os = require('os');
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const merge = require('merge');

const ENV = process.env;
const PLATFORM = os.platform();
const DIRNAME = '.metadisk';
const HOME = PLATFORM === 'win32' ? ENV.USER_PROFILE : ENV.HOME;
const DATADIR = path.join(HOME, DIRNAME);
const CONFDIR = path.join(DATADIR, 'config');
const ITEMDIR = path.join(DATADIR, 'items');

if (!fs.existsSync(DATADIR)) {
  fs.mkdirSync(DATADIR);
}

if (!fs.existsSync(CONFDIR)) {
  fs.mkdirSync(CONFDIR);
}

if (!fs.existsSync(ITEMDIR)) {
  fs.mkdirSync(ITEMDIR);
}

/**
 * Represents a configuration
 * @constructor
 * @param {String} env
 */
function Config(env) {
  if (!(this instanceof Config)) {
    return new Config(env);
  }

  assert(typeof env === 'string', 'Invalid environment name supplied');
  assert(env.length > 0, 'Invalid environment name supplied');

  var envConfigPath = path.join(CONFDIR, env);

  if (!fs.existsSync(envConfigPath)) {
    fs.writeFileSync(envConfigPath, JSON.stringify({}, null, 2));
  }

  var config = merge(
    Object.create(Config.DEFAULTS),
    JSON.parse(fs.readFileSync(envConfigPath))
  );

  for (let prop in config) {
    if (config.hasOwnProperty(prop)) {
      this[prop] = config[prop];
    }
  }
}

Config.DEFAULTS = {
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: 'metadisk-dev',
    user: null,
    pass: null,
    mongos: false
  },
  server: {
    host: '127.0.0.1',
    port: 6382,
    ssl: {
      cert: null,
      key: null,
      ca: [],
      redirect: 80
    }
  },
  network: {
    address: '127.0.0.1',
    port: 6383,
    privkey: null,
    verbosity: 4,
    datadir: ITEMDIR,
    seed: {
      address: '',
      port: 0,
      pubkey: null
    }
  },
  mailer: {
    host: '127.0.0.1',
    port: 465,
    secure: true,
    auth: {
      user: 'username',
      pass: 'password'
    },
    from: 'robot@metadisk.org'
  }
};

module.exports = Config;
