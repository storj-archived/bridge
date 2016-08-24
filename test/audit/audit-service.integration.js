'use strict'

const fs = require('fs');
const crypto = require('crypto');
const noisegen = require('noisegen');
const async = require('async');
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const storj = require('storj');
const Storage = require('../../lib/storage');
const Config = require('../../lib/config');
const Audit = require('../../lib/audit');
const develop = require('../../script/develop');

describe('Audit/Integration', function() {

  var environment, storage;
  var aInterface = Audit.interface();
  var keypair = storj.KeyPair();
  var client = storj.BridgeClient('http://127.0.0.1:6382');
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
    this.timeout(80000);
    Audit.service();
    storage = Storage(Config.DEFAULTS.storage);
    storage.connection.on('connected', function() {
      async.forEachOf(storage.models, function(model, name, done) {
        model.remove({}, done);
      }, function() {
        environment = develop(createUser);
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
      for(var key in aInterface.redisQueue.rKeys) {
        allKeys.push(aInterface.redisQueue.rKeys[key]);
      }
      aInterface.redisQueue.client.DEL(allKeys, done);
    });

    function logErr(err, item) {
      if(err) {console.log(err);}
    }
  });

  describe('E2E', function() {
    before(function(done) {
      //set up subscriber
      aInterface.subscriber.on('message', function(channel, msg){
        console.log(channel);
        console.log(message);
      });

      //revise audit timeline
      var lastTime;
      var command = [aInterface.redisQueue.rKeys.backlog];

      aInterface.redisQueue.client.ZREVRANGE(
        aInterface.redisQueue.rKeys.backlog,
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
          console.log(command)
          aInterface.redisQueue.client.ZADD(command, function(err, resp) {
            aInterface.redisQueue.client.ZREVRANGE(
              aInterface.redisQueue.rKeys.backlog,
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
    it('should create a shedule of audits in the backlog', function() {

    });

    it('should send audits in acceptable time window', function(done) {
      var acceptable = 1000;
      this.timeout(20100);
      setTimeout(done, 20000);
    });

    it('should pass all provided audits', function() {

    });

  });

  describe('Component Failures', function() {
    //tests behavior in case of DB failures
    before(function(done) {

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
