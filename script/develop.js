'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const storj = require('storj');
const async = require('async');
const knuthShuffle = require('knuth-shuffle').knuthShuffle;
const logger = require('../lib/logger');
const rimraf = require('rimraf');
const Storage = require('../lib/storage');
const Config = require('../lib/config');
const Engine = require('../lib/engine');

var privkey = storj.KeyPair().getPrivateKey();

var FARMERS = [
  {
    key: '71b742ba25efaef1fffc1d9c9574c3260787628f5c3f43089e0b3a6bdc123a52',
    port: 4000
  },
  {
    key: '2bb9794ef6c33be4472652550478b8ca91d48127f98681e276f46cc827afe744',
    port: 4001
  },
  {
    key: 'bd97014b3a6eaadc3a42fea0514c059ddaa2ca51cda3e85fb7c56843f43a99d0',
    port: 4002
  },
  {
    key: '9ebcf31753d81487391933afc2868831b231b72ebf038246d6cfc45f62bdc8eb',
    port: 4003
  },
  {
    key: '7e3b11b94cf2b81de4d1a1473f053ad81e0c8fd03fa95236c1121cbdd98a07ad',
    port: 4004
  },
  {
    key: '609759f6d76611f880a4a1d6a4391609ab1bf332cda75f287edf876ff08cfae7',
    port: 4005
  }
];

var MINIONS = [
  {
    privkey: privkey,
    address: process.env.CONTACT_IP || '127.0.0.1',
    port: 6383,
    noforward: true,
    tunport: 6483,
    gateways: { min: 0, max: 0 }
  },
  {
    privkey: privkey,
    address: process.env.CONTACT_IP || '127.0.0.1',
    port: 6384,
    noforward: true,
    tunport: 6484,
    gateways: { min: 0, max: 0 }
  }
];

if (process.env.NODE_ENV === 'develop') {
  MINIONS.push({
    privkey: privkey,
    address: process.env.CONTACT_IP || '127.0.0.1',
    port: 6385,
    noforward: true,
    tunport: 6485,
    gateways: { min: 0, max: 0 }
  });
}

const STORAGE_PATH = process.env.NODE_ENV === 'develop' ?
                     path.join(os.tmpdir(), 'storj-bridge-develop') :
                     path.join(os.tmpdir(), 'storj-bridge-test');

FARMERS.forEach(function(farmer) {
  if (process.env.NODE_ENV !== 'develop') {
    if (fs.existsSync(STORAGE_PATH + '-' + farmer.key)) {
      rimraf.sync(STORAGE_PATH + '-' + farmer.key);
    }
  }

  if (!fs.existsSync(STORAGE_PATH + '-' + farmer.key)) {
    fs.mkdirSync(STORAGE_PATH + '-' + farmer.key);
  }
});

var config = Config({
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: process.env.NODE_ENV === 'develop' ?
          '__storj-bridge-develop' :
          Config.DEFAULTS.storage.name
  },
  server: {
    host: '127.0.0.1',
    port: 6382,
    ssl: {}
  },
  network: {
    minions: MINIONS
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

module.exports = function start(callback) {
  if (process.env.NODE_ENV === 'develop') {
    console.log('Storj Bridge in DEVELOP mode with configuration:');
    console.log('');
    console.log(config);
    console.log('');
  }

  // Set up Storj Bridge Server
  var farmers = [];
  var engine = Engine(config);
  var storage = Storage(config.storage);

  function createFarmer(key, port, done) {
    // Set up Storj Farmer
    var farmer = storj.FarmerInterface({
      keypair: storj.KeyPair(key),
      address: process.env.CONTACT_IP || '127.0.0.1',
      storage: {
        path: STORAGE_PATH + '-' + key,
        size: 10,
        unit: 'GB'
      },
      port: port,
      seeds: knuthShuffle(
        engine.getSpecification().info['x-network-seeds']
      ),
      logger: logger,
      opcodes: ['0f01020202', '0f02020202', '0f03020202'],
      noforward: true,
      concurrency: 12,
      tunport: 0
    });

    // Seed the Bridge
    farmer.join(function(err) {
      if (err) {
        console.log(err);
        process.exit();
      }

      done();
    });

    return farmer;
  }

  // Clear the known contacts
  storage.models.Contact.remove({}, function() {
    // Start the service
    engine.start(function() {
      // Start the farmers
      async.eachSeries(FARMERS, function(farmer, done) {
        farmers.push(createFarmer(farmer.key, farmer.port, done));
      }, callback);
    });
  });

  return {
    kill: function(callback) {
      // Close down Bridge Server
      engine.server.server.close();
      // Drop the local database again
      async.each(Object.keys(engine.storage.models), function(model, next) {
        engine.storage.models[model].remove({}, next);
      }, function() {
        // Close down farmer
        async.each(farmers, function(farmer, done) {
          farmer.leave(function() {
            engine.storage.connection.close(done);
          });
        }, callback);
      });
    }
  };
};

if (process.argv[2] === 'start') {
  module.exports();
}
