'use strict';

const async = require('async');
const expect = require('chai').expect;
const storj = require('storj');
const bridge = require('storj-bridge-client');

const logger = require('..').logger;
const Config = require('..').Config;
const Engine = require('..').Engine;

describe('Engine/Integration', function() {

  var engine, farmer;
  var keypair = bridge.KeyPair();
  var client = bridge.Client('http://127.0.0.1:6382');

  before(function(done) {
    // Set up Bridge Server
    engine = Engine(Config('__tmptest'));
    // Start the service
    engine.start(function() {
      // Drop the local database
      async.each(Object.keys(engine.storage.models), function(model, next) {
        engine.storage.models[model].remove({}, next);
      }, function() {
        // Set up Storj Farmer
        farmer = storj.FarmerInterface({
          keypair: storj.KeyPair(),
          manager: storj.Manager(storj.FSStorageAdapter(
            require('os').tmpdir() + '/storj-bridge-testrunner-' + Date.now())
          ),
          address: '127.0.0.1',
          port: 4000,
          seeds: [engine.getSpecification().info['x-network-seed']],
          logger: logger,
          opcodes: ['0f01020202', '0f02020202', '0f03020202'],
          noforward: true
        });
        // Seed Bridge
        farmer.join(done);
      });
    });
  });

  after(function(done) {
    // Close down Bridge Server
    engine.server.server.close();
    // Drop the local database again
    async.each(Object.keys(engine.storage.models), function(model, next) {
      engine.storage.models[model].remove({}, next);
    }, function() {
      // Close down farmer
      farmer.leave(function() {
        engine.storage.connection.close(done);
      });
    });
  });

  describe('POST /users', function() {

    let keypair = bridge.KeyPair();

    it('should register the user account', function(done) {
      client.createUser('test@domain.tld', 'password').then(function(user) {
        expect(user.email).to.equal('test@domain.tld');
        expect(user.activated).to.equal(false);
        done();
      });
    });

    it('should register the user account with a pubkey', function(done) {
      client.createUser(
        'test2@domain.tld',
        'password',
        null,
        keypair.getPublicKey()
      ).then(function(result) {
        expect(result.pubkey).to.equal(keypair.getPublicKey());
        done();
      });
    });

    it('should fail to use inactive user account basicauth', function(done) {
      let tmpclient = bridge.Client('http://127.0.0.1:6382', {
        basicauth: {
          email: 'test2@domain.tld',
          password: 'password'
        }
      });
      tmpclient.getPublicKeys().catch(function(err) {
        expect(err.message).to.equal('User account has not been activated');
        done();
      });
    });

    it('should fail to use inactive user account pubkey', function(done) {
      let tmpclient = bridge.Client('http://127.0.0.1:6382', {
        keypair: keypair
      });
      tmpclient.getPublicKeys().catch(function(err) {
        expect(err.message).to.equal('User account has not been activated');
        done();
      });
    });

  });

  describe('POST /activations/:token', function() {

    it('should fail to activate the user with invalid token', function(done) {
      client._request('GET', '/activations/INVALID', {}).catch(function(err) {
        expect(err.message).to.equal('Invalid activation token');
        done();
      });
    });

    it('should activate the user account', function(done) {
      engine.storage.models.User.findOne({}, function(err, user) {
        client._request('GET', '/activations/' + user.activator, {}).then(function(user) {
          expect(user.activated).to.equal(true);
          done();
        });
      });
    });

  });

  describe('POST /keys', function() {

    before(function() {
      client = bridge.Client('http://127.0.0.1:6382', {
        basicauth: {
          email: 'test@domain.tld',
          password: 'password'
        }
      });
    });

    it('should register the public key for the user', function(done) {
      client.addPublicKey(keypair.getPublicKey()).then(function(pubkey) {
        expect(pubkey.key).to.equal(keypair.getPublicKey());
        done();
      });
    });

    after(function() {
      client = bridge.Client('http://127.0.0.1:6382', {
        keypair: keypair
      });
    });

  });

  describe('GET /keys', function() {

    it('should list the registered keys for the user', function(done) {
      client.getPublicKeys().then(function(keys) {
        expect(keys).to.have.lengthOf(1);
        done();
      });
    });

  });

  describe('DELETE /keys/:pubkey', function() {

    it('should invalidate the supplied public key', function(done) {
      client.addPublicKey(
        bridge.KeyPair().getPublicKey()
      ).then(function(key) {
        client.destroyPublicKey(key.key).then(function(result) {
          expect(result).to.equal(undefined);
          client.getPublicKeys().then(function(keys) {
            expect(keys).to.have.lengthOf(1);
            done();
          });
        });
      });
    });

  });

  describe('POST /buckets', function() {

    it('should create a new bucket', function(done) {
      client.createBucket({
        name: 'Test Bucket'
      }).then(function(bucket) {
        expect(bucket.name).to.equal('Test Bucket');
        done();
      });
    });

  });

  describe('GET /buckets', function() {

    it('should return a list of buckets', function(done) {
      client.getBuckets().then(function(buckets) {
        expect(buckets).to.have.lengthOf(1);
        done();
      });
    });

  });

  describe('GET /buckets/:id', function() {

    it('should return the bucket by the supplied ID', function(done) {
      client.getBuckets().then(function(buckets) {
        client.getBucketById(buckets[0].id).then(function(bucket) {
          expect(bucket.id).to.equal(buckets[0].id);
          done();
        });
      });
    });

  });

  describe('PATCH /buckets/:id', function() {

    it('should update the bucket information', function(done) {
      client.getBuckets().then(function(buckets) {
        client.updateBucketById(buckets[0].id, {
          name: 'My App Name'
        }).then(function(bucket) {
          expect(bucket.name).to.equal('My App Name');
          done();
        });
      });
    });

  });

  describe('DELETE /buckets/:id', function() {

    it('should destroy the bucket by the supplied ID', function(done) {
      client.createBucket({
        name: 'Marked For Death'
      }).then(function(bucket) {
        expect(bucket.name).to.equal('Marked For Death');
        client.destroyBucketById(bucket.id).then(function() {
          client.getBuckets().then(function(buckets) {
            expect(buckets).to.have.lengthOf(1);
            done();
          });
        });
      });
    });

  });

  describe('POST /buckets/:id/tokens', function() {

    it('should create a PULL token for the bucket', function(done) {
      client.getBuckets().then(function(buckets) {
        client.createToken(buckets[0].id, 'PULL').then(function(token) {
          expect(token.operation).to.equal('PULL');
          expect(token.bucket).to.equal(buckets[0].id);
          done();
        }, done);
      });
    });

    it('should create a PUSH token for the bucket', function(done) {
      client.getBuckets().then(function(buckets) {
        client.createToken(buckets[0].id, 'PUSH').then(function(token) {
          expect(token.operation).to.equal('PUSH');
          expect(token.bucket).to.equal(buckets[0].id);
          done();
        }, done);
      });
    });

    it('should allow authorized unregistered key create token', function(done) {
      client.getBuckets().then(function(buckets) {
        let unregkp = bridge.KeyPair();
        client.updateBucketById(buckets[0].id, {
          pubkeys: buckets[0].pubkeys.concat([unregkp.getPublicKey()])
        }).then(function(bucket) {
          let tmpclient = bridge.Client('http://127.0.0.1:6382', {
            keypair: unregkp
          });
          tmpclient.createToken(bucket.id, 'PULL').then(function(token) {
            expect(token.operation).to.equal('PULL');
            expect(token.bucket).to.equal(bucket.id);
            done();
          }, done);
        });
      });
    });

    it('should not allow unauthorized key create token', function(done) {
      client.getBuckets().then(function(buckets) {
        let unregkp = bridge.KeyPair();
        let tmpclient = bridge.Client('http://127.0.0.1:6382', {
          keypair: unregkp
        });
        tmpclient.createToken(buckets[0].id, 'PULL').catch(function(err) {
          expect(err.message).to.equal('Bucket not found');
          done();
        });
      });
    });

  });

  describe('GET /buckets/:id/files', function() {

    it.skip('should list the files in the bucket', function(done) {
      client.getBuckets().then(function(buckets) {
        client.listFilesInBucket(buckets[0].id).then(function(files) {
          expect(files).to.have.lengthOf(1);
          done();
        }, done);
      }, done);
    });

  });

  describe('GET /buckets/:id/files/:hash', function() {

    it.skip('should return the file pointer payloads for the file', function(done) {
      client.getBuckets().then(function(buckets) {
        client.listFilesInBucket(buckets[0].id).then(function(files) {
          client.createToken(buckets[0].id, 'PULL').then(function(token) {
            client.getFilePointer(
              buckets[0].id,
              token.token,
              files[0].hash
            ).then(function(pointers) {
              expect(Array.isArray(pointers)).to.equal(true);
              expect(pointers).to.have.lengthOf(1);
              client.resolveFileFromPointers(pointers).on('data', function(chunk) {
                expect(chunk.toString()).to.equal('Hello Storj Bridge!');
              }).on('end', done).on('error', done);
            }, done);
          }, done);
        }, done);
      }, done);
    });

    it.skip('should return an error if hash is not found', function(done) {
      client.getBuckets().then(function(buckets) {
        client.createToken(buckets[0].id, 'PULL').then(function(token) {
          client.getFilePointer(
            buckets[0].id,
            token.token,
            'INVALIDHASH'
          ).then(function() {
            done(new Error('Error was not returned'));
          }, function(err) {
            expect(err.message).to.equal('The requested file was not found');
            done();
          });
        });
      });
    });

  });

  describe('Authentication/PublicKey', function() {

    it('should verify the signature', function(done) {
      var kp = bridge.KeyPair();
      var newclient = bridge.Client('http://127.0.0.1:6382', {
        keypair: kp
      });
      client.addPublicKey(kp.getPublicKey()).then(function() {
        newclient.getPublicKeys().then(function(keys) {
          expect(Array.isArray(keys)).to.equal(true);
          done();
        }, done);
      }, done);
    });

  });

});
