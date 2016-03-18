'use strict';

const async = require('async');
const expect = require('chai').expect;
const storj = require('storj');
const metadisk = require('metadisk-client');

const Config = require('..').Config;
const Engine = require('..').Engine;

describe('Engine/Integration', function() {

  var engine, farmer;
  var keypair = metadisk.KeyPair();
  var client = metadisk.Client('http://127.0.0.1:6382');

  before(function(done) {
    // Set up MetaDisk API Server
    engine = Engine(Config('__tmptest'));
    // Start the service
    engine.start(function() {
      // Drop the local database
      async.each(Object.keys(engine.storage.models), function(model, next) {
        engine.storage.models[model].remove({}, next);
      }, function() {
        // Set up Storj Farmer
        farmer = storj.Network({
          keypair: storj.KeyPair(),
          manager: storj.Manager(storj.FSStorageAdapter(
            require('os').tmpdir() + '/metadisk-testrunner-' + Date.now())
          ),
          contact: {
            address: '127.0.0.1',
            port: 4000
          },
          seeds: [engine.getSpecification().info['x-network-seed']],
          loglevel: 1,
          datadir: require('os').tmpdir(),
          farmer: true,
          noforward: true
        });
        // Seed metadisk
        farmer.join(done);
      });
    });
  });

  after(function(done) {
    // Close down MetaDisk API Server
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

    it('should register the user account', function(done) {
      client.createUser('test@domain.tld', 'password').then(function(user) {
        expect(user.email).to.equal('test@domain.tld');
        expect(user.activated).to.equal(false);
        done();
      });
    });

    it('should fail to register a duplicate email', function(done) {
      client.createUser('test@domain.tld', 'password').catch(function(err) {
        expect(err.message).to.equal('Email is already registered');
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
      client = metadisk.Client('http://127.0.0.1:6382', {
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
      client = metadisk.Client('http://127.0.0.1:6382', {
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
        metadisk.KeyPair().getPublicKey()
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
        });
      });
    });

    it('should create a PUSH token for the bucket', function(done) {
      client.getBuckets().then(function(buckets) {
        client.createToken(buckets[0].id, 'PUSH').then(function(token) {
          expect(token.operation).to.equal('PUSH');
          expect(token.bucket).to.equal(buckets[0].id);
          done();
        });
      });
    });

  });

  describe('PUT /buckets/:id/files', function() {

    it('should store the file in the bucket', function(done) {
      this.timeout(8000);
      client.getBuckets().then(function(buckets) {
        client.createToken(buckets[0].id, 'PUSH').then(function(token) {
          client.storeFileInBucket(
            token.bucket,
            token.token,
            new Buffer('Hello MetaDisk API!')
          ).then(function(file) {
            expect(file.hash).to.equal('d72d91d8ec94f89f5b6b84be2a03ba661a34c1e2');
            expect(file.size).to.equal(19);
            expect().to.equal();
            done();
          }, done);
        });
      });
    });

    it('should put a duplicate file in another bucket', function(done) {
      this.timeout(8000);
      client.createBucket().then(function(bucket) {
        client.createToken(bucket.id, 'PUSH').then(function(token) {
          client.storeFileInBucket(
            token.bucket,
            token.token,
            new Buffer('Hello MetaDisk API!')
          ).then(function(file) {
            expect(file.bucket).to.equal(bucket.id);
            expect(file.hash).to.equal('d72d91d8ec94f89f5b6b84be2a03ba661a34c1e2');
            expect(file.size).to.equal(19);
            expect().to.equal();
            done();
          }, done);
        });
      });
    });

  });

  describe('GET /buckets/:id/files', function() {

    it('should list the files in the bucket', function(done) {
      client.getBuckets().then(function(buckets) {
        client.listFilesInBucket(buckets[0].id).then(function(files) {
          expect(files).to.have.lengthOf(1);
          done();
        }, done);
      });
    });

  });

  describe('GET /buckets/:id/files/:hash', function() {

    it('should return the file pointer payloads for the file', function(done) {
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
                expect(chunk.toString()).to.equal('Hello MetaDisk API!');
              }).on('end', done).on('error', done);
            }, done);
          });
        });
      });
    });

    it('should return an error if hash is not found', function(done) {
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
      var kp = metadisk.KeyPair();
      var newclient = metadisk.Client('http://127.0.0.1:6382', {
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
