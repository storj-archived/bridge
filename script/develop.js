'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const storj = require('storj');
const logger = require('../lib/logger');
const Config = require('../lib/config');
const Engine = require('../lib/engine');

const STORAGE_PATH = path.join(os.tmpdir(), 'storj-bridge-develop');

if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH);
}

var config = Config({
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: '__storj-bridge-develop'
  },
  server: {
    host: '127.0.0.1',
    port: 6382,
    ssl: {}
  },
  network: {
    address: '127.0.0.1',
    port: 6383,
    verbosity: 4,
    datadir: require('os').tmpdir(),
    farmer: false,
    noforward: true
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
});

console.log('Storj Bridge in DEVELOP mode with configuration:');
console.log('');
console.log(config);
console.log('');

// Set up Storj Bridge Server
var engine = Engine(config);

// Start the service
engine.start(function() {

  // Set up Storj Farmer
  var farmer = storj.FarmerInterface({
    keypair: storj.KeyPair('71b742ba25efaef1fffc1d9c9574c3260787628f5c3f43089e0b3a6bdc123a52'),
    address: '127.0.0.1',
    storage: {
      path: STORAGE_PATH
    },
    port: 4000,
    seeds: [engine.getSpecification().info['x-network-seed']],
    logger: logger,
    opcodes: ['0f01020202', '0f02020202', '0f03020202'],
    noforward: true
  });

  // Seed the Bridge
  farmer.join(function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
});
