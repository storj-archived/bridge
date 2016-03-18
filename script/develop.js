'use strict';

const storj = require('storj');
const Config = require('../lib/config');
const Engine = require('../lib/engine');

var config = Config({
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: '__metadisk-develop'
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
    from: 'robot@metadisk.org'
  }
});

console.log('MetaDisk API in DEVELOP mode with configuration:');
console.log('');
console.log(config);
console.log('');

// Set up MetaDisk API Server
var engine = Engine(config);

// Start the service
engine.start(function() {

  // Set up Storj Farmer
  var farmer = storj.Network({
    keypair: storj.KeyPair('71b742ba25efaef1fffc1d9c9574c3260787628f5c3f43089e0b3a6bdc123a52'),
    manager: storj.Manager(storj.RAMStorageAdapter()),
    contact: {
      address: '127.0.0.1',
      port: 4000
    },
    seeds: [engine.getSpecification().info['x-network-seed']],
    loglevel: 4,
    datadir: require('os').tmpdir(),
    farmer: true,
    noforward: true
  });

  // Seed metadisk
  farmer.join(function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
});
