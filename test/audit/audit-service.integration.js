'use strict'

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const merge = require('merge');
const noisegen = require('noisegen');
const async = require('async');
const expect = require('chai').expect;
const sinon = require('sinon');
const redis = require('redis');
const proxyquire = require('proxyquire');
const storj = require('storj');
const Storage = require('../../lib/storage');
const Config = require('../../lib/config');
const Audit = require('../../lib/audit');
const Queue = require('../../lib/audit/adapters/redis/queue');
const develop = require('../../script/develop');

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

describe('Audit/Integration', function() {
  var adapter = {
    host: '127.0.0.1',
    port: 6379,
    user: null,
    pass: null,
    polling: {
      interval: 10000,
      padding: 1000
    }
  };
  var environment, storage;
  var aInterface = Audit.interface();
  var keypair = storj.KeyPair();
  var client = storj.BridgeClient('http://127.0.0.1:6382');
  var rClient = redis.createClient(adapter);
  var cred = {
    email: 'auditwizard@tardis.ooo',
    password: 'password',
  };

  before(function(done) {
    console.log('                                    ');
    console.log('  ********************************  ');
    console.log('  * SPINNING UP TEST ENVIRONMENT *  ');
    console.log('  *       GRAB A COCKTAIL!       *  ');
    console.log('  ********************************  ');
    console.log('  (this can take up to 30 seconds)  ');
    console.log('                                    ');
    this.timeout(100000);
    if (!fs.existsSync(ITEMDIR)) {
      fs.mkdirSync(ITEMDIR);
    }

    storage = Storage(Config.DEFAULTS.storage);
    storage.connection.on('connected', function() {
      async.forEachOf(storage.models, function(model, name, done) {
        model.remove({}, done);
      }, function() {
        environment = develop(function(err, config) {
          adapter.type = 'redis';
          Audit.service({
            adapter: adapter,
            workers: [{
              uuid: 123,
              limit: 20,
              network: {
                address: '127.0.0.1',
                port: 6234,
                privkey: config.network.minions[0].privkey,
                verbosity: 3,
                datadir: ITEMDIR,
                farmer: false,
                noforward: true,
                tunnels: 0,
                tunport: null,
                gateways: { min: 0, max: 0 }
              }
            }]
          });

          createUser();
        });
      });
    });

    function createUser() {
      client.createUser(cred, function(err, user) {
        if(err) {console.log(err);}
        storage.models.User.findOne({_id: user.id}, function(err, user) {
          if (err) { return done(err); }
          client._request('GET', '/activations/' + user.activator, {}, function(err, user) {
            if (err) { return done(err); }
            client = storj.BridgeClient('http://127.0.0.1:6382', {
              basicauth: cred
            });
            createBucket();
          });
        });
      });
    }

    function createBucket() {
      client.createBucket({
        name: 'BuckyMcBucketface'
      }, function(err, bucket) {
        if (err) { return done(err); }
        makeSomeData(bucket);
      });
    }

    function makeSomeData(bucket) {
      var randomName = crypto.randomBytes(6).toString('hex');
      var filePath = require('os').tmpdir() + '/' + randomName + '.txt';
      var randomio = noisegen({ length: 1024 * 1024 * 32 });
      var target = fs.createWriteStream(filePath);
      target.on('finish', function() {
        client.getBuckets(function(err, buckets) {
          if (err) { return done(err); }
          client.createToken(buckets[0].id, 'PUSH', function(err, token) {
            if (err) { return done(err); }
            client.storeFileInBucket(
              buckets[0].id,
              token,
              filePath,
              function(err, entry) {
                if (err) { return done(err); }
                return done();
              }
            );
          });
        });
      });
      randomio.pipe(target);
    }
  });

  after(function(done) {
    var allKeys = [];
    environment.kill(function() {
      for(var key in Queue.sharedKeys) {
        allKeys.push(Queue.sharedKeys[key]);
      }

      allKeys.push(
        'storj:audit:full:pending:123',
        'storj:audit:full:pending:undefined'
      );

      rClient.DEL(allKeys, function() {
        done();
      });
    });

    function logErr(err, item) {
      if(err) {console.log(err);}
    }
  });

  describe('E2E', function() {
    before(function(done) {
      this.timeout(100000);
      //set up subscriber
      aInterface.subscriber.on('message', function(channel, msg){
        console.log('pubsub')
        console.log(channel);
        console.log(message);
      });

      //revise audit timeline
      var lastTime;
      var command = [Queue.sharedKeys.backlog];

      rClient.ZREVRANGE(
        Queue.sharedKeys.backlog,
        0,
        -1,
        function(err, audits) {
          lastTime = Date.now();
          audits.forEach(function(elem, ind, arr) {
            if(ind === 0 || ind % 2 === 0) {
              lastTime = lastTime + 5000;
              command.push(lastTime);
            } else {
              command.push(elem);
            }
          })

          rClient.ZADD(command, function(err, resp) {
            rClient.ZREVRANGE(
              Queue.sharedKeys.backlog,
              0,
              -1,
              function() {
                done();
              });
          });
      });
    });
    /*
    after(function(done) {

    });
    */
    it('should create a shedule of audits in the backlog', function(done) {
      this.timeout(100000);
    });
/*
    it('should send audits in acceptable time window', function(done) {
      var acceptable = 1000;
      this.timeout(20100);
      setTimeout(done, 20000);
    });
*/
    it('should pass all provided audits', function() {

    });

  });

  describe('Component Failures', function() {
    //tests behavior in case of DB failures
    before(function() {

    });

    it('should restart workers on failure', function() {

    });

    it('should retry failed redis requests, before exiting', function() {

    });

  });

  describe('Farmer Failures', function() {
    //tests behavior in case of Farmer failures
    it('should fail all provided audits', function() {

    });

  });
});
