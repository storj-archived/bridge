'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const merge = require('merge');

const ENV = process.env;
const PLATFORM = os.platform();
const DIRNAME = '.storj-bridge';
const HOME = PLATFORM === 'win32' ? ENV.USERPROFILE : ENV.HOME;
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
 * @param {String|Object} env
 */
function Config(env) {
  if (!(this instanceof Config)) {
    return new Config(env);
  }

  var config;

  if (typeof env === 'string') {
    var envConfigPath = path.join(CONFDIR, env);

    if (!fs.existsSync(envConfigPath)) {
      fs.writeFileSync(envConfigPath, JSON.stringify(Config.DEFAULTS, null, 2));
    }

    config = merge(
      Object.create(Config.DEFAULTS),
      JSON.parse(fs.readFileSync(envConfigPath))
    );
  } else {
    config = merge(Object.create(Config.DEFAULTS), env);
  }

  for (let prop in config) {
    if (config.hasOwnProperty(prop)) {
      this[prop] = config[prop];
    }
  }
}

Config.DEFAULTS = {
  application: {
    mirrors: 6
  },
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: '__storj-bridge-test',
    user: null,
    pass: null,
    mongos: false,
    ssl: false
  },
  audits: {
    adapter: {
      type: 'redis',
      host: '127.0.0.1',
      port: 6379,
      user: null,
      pass: null,
      polling: {
        interval: 10000,
        padding: 1000
      }
    },
    workers: [{
      uuid: 123,
      limit: 20,
      network: {
        address: '127.0.0.1',
        port: 6385,
        privkey: null,
        verbosity: 3,
        datadir: ITEMDIR,
        farmer: false,
        noforward: true,
        tunnels: 0,
        tunport: null,
        gateways: { min: 0, max: 0 }
      }
    }]
  },
  messaging: {
    url: 'amqp://localhost',
    queues: {
      renterpool: { // a shared work queue
        name: 'storj.work.renterpool',
        options: {
          exclusive: false,
          durable: true,
          arguments: {
            messageTtl: 120 * 1000 // messages expires after 120 seconds with no response
          }
        }
      },
      callback: { // each process gets a unique callback queue, to use in replyTo
        name: '', // dynamically generated
        options: {
          exclusive: true,
          durable: false
        }
      }
    },
    exchanges: {
      events: {
        name: 'storj.events',
        type: 'topic',
        options: {
          durable: true
        }
      }
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
  network: {
    minions: [{
      bridge: false,
      privkey: null,
      address: '127.0.0.1',
      port: 6383,
      noforward: true,
      tunnels: 32,
      tunport: 6384,
      gateways: { min: 0, max: 0 }
    },
    {
      bridge: false,
      privkey: null,
      address: '127.0.0.1',
      port: 6385,
      noforward: true,
      tunnels: 32,
      tunport: 6386,
      gateways: { min: 0, max: 0 }
    },
    {
      bridge: false,
      privkey: null,
      address: '127.0.0.1',
      port: 6387,
      noforward: true,
      tunnels: 32,
      tunport: 6388,
      gateways: { min: 0, max: 0 }
    }],
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

module.exports = Config;
