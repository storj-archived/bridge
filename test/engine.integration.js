'use strict';

const fs = require('fs');
const noisegen = require('noisegen');
const crypto = require('crypto');
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
    this.timeout(20000);
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
          backend: require('memdown'),
          address: '127.0.0.1',
          port: 4000,
          seeds: engine.getSpecification().info['x-network-seeds'],
          logger: logger,
          opcodes: ['0f01020202', '0f02020202', '0f03020202'],
          noforward: true
        });
        // Seed Bridge
        farmer.join(function() {});
        done();
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

  describe('UsersRouter', function() {

    describe('POST /users', function() {

      let keypair = bridge.KeyPair();

      it('should register the user account', function(done) {
        client.createUser('test@domain.tld', 'password').then(function(user) {
          expect(user.email).to.equal('test@domain.tld');
          expect(user.activated).to.equal(false);
          done();
        }, done);
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
        }, done);
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
        }, done);
      });

      it('should fail to use inactive user account pubkey', function(done) {
        let tmpclient = bridge.Client('http://127.0.0.1:6382', {
          keypair: keypair
        });
        tmpclient.getPublicKeys().catch(function(err) {
          expect(err.message).to.equal('User account has not been activated');
          done();
        }, done);
      });

      it('should not create duplicate key', function(done) {
        client.createUser(
          'test4@domain.tld',
          'password',
          null,
          keypair.getPublicKey()
        ).catch(function(err) {
          expect(err.message).to.equal(
            'Public key is already registered'
          );
          done();
        });
      });

      it('should reject an invalid ecdsa key', function(done) {
        client.createUser(
          'test5@domain.tld',
          'password',
          null,
          'testkey'
        ).catch(function(err) {
          expect(err.message).to.equal(
            'Invalid public key supplied: Invalid hex string'
          );
          done();
        });
      });

    });

    describe('POST /activations/:token', function() {

      it('should fail to activate the user with invalid token', function(done) {
        client._request('GET', '/activations/INVALID', {}).catch(function(err) {
          expect(err.message).to.equal('Invalid activation token');
          done();
        }, done);
      });

      it('should activate the user account', function(done) {
        engine.storage.models.User.findOne({}, function(err, user) {
          client._request('GET', '/activations/' + user.activator, {}).then(function(user) {
            expect(user.activated).to.equal(true);
            done();
          }, done);
        });
      });

    });

  });

  describe('PublicKeysRouter', function() {

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
        }, done);
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
        }, done);
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
            }, done);
          }, done);
        }, done);
      });

    });

  });

  describe('FramesRouter', function() {

    describe('POST /frames', function() {



    });

    describe('PUT /frames/:frame_id', function() {



    });

    describe('GET /frames', function() {



    });

    describe('GET /frames/:frame_id', function() {



    });

    describe('DELETE /frames/:frame_id', function() {



    });

  });

  describe('BucketsRouter', function() {

    describe('POST /buckets', function() {

      it('should create a new bucket', function(done) {
        client.createBucket({
          name: 'Test Bucket'
        }).then(function(bucket) {
          expect(bucket.name).to.equal('Test Bucket');
          done();
        }, done);
      });

      it('should allow duplicate key', function(done) {
        client.createBucket({
          name: 'Test Bucket duplicate key',
          pubkeys: [ keypair.getPublicKey() ]
        }).then(function(bucket) {
          expect(bucket.name).to.equal('Test Bucket duplicate key');
          expect(bucket.pubkeys).to.have.lengthOf(1);
          expect(bucket.pubkeys[0]).to.equal(keypair.getPublicKey());
          done();
        });
      });

      it('should reject an invalid ecdsa key', function(done) {
        client.createBucket({
          name: 'Test Bucket invalid ecdsa key',
          pubkeys: [ 'testkey' ]
        }).catch(function(err) {
          expect(err.message).to.equal(
            'Invalid public key supplied'
          );
          done();
        });
      });

    });

    describe('GET /buckets', function() {

      it('should return a list of buckets', function(done) {
        client.getBuckets().then(function(buckets) {
          expect(buckets).to.have.lengthOf(2);
          done();
        }, done);
      });

    });

    describe('GET /buckets/:id', function() {

      it('should return the bucket by the supplied ID', function(done) {
        client.getBuckets().then(function(buckets) {
          client.getBucketById(buckets[0].id).then(function(bucket) {
            expect(bucket.id).to.equal(buckets[0].id);
            done();
          }, done);
        }, done);
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
          }, done);
        }, done);
      });

      it('should update the bucket information', function(done) {
        client.getBuckets().then(function(buckets) {
          client.updateBucketById(buckets[0].id, {
            name: 'Test Bucket invalid ecdsa key',
            pubkeys: [ 'testkey' ]
          }).catch(function(err) {
            expect(err.message).to.equal(
              'Invalid public key supplied'
            );
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
              expect(buckets).to.have.lengthOf(2);
              done();
            }, done);
          }, done);
        }, done);
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
        }, done);
      });

      it('should create a PUSH token for the bucket', function(done) {
        client.getBuckets().then(function(buckets) {
          client.createToken(buckets[0].id, 'PUSH').then(function(token) {
            expect(token.operation).to.equal('PUSH');
            expect(token.bucket).to.equal(buckets[0].id);
            done();
          }, done);
        }, done);
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
          }, done);
        }, done);
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
          }, done);
        }, done);
      });

    });

    describe('POST /buckets/:bucket_id/files', function() {

      it('should store the file in the bucket', function(done) {
        this.timeout(20000);
        var randomName = crypto.randomBytes(6).toString('hex');
        var filePath = require('os').tmpdir() + '/' + randomName + '.txt';
        var randomio = noisegen({ length: 1024 * 1024 * 16 });
        var target = fs.createWriteStream(filePath);
        target.on('finish', function() {
          client.getBuckets().then(function(buckets) {
            client.createToken(buckets[0].id, 'PUSH').then(function(token) {
              client.storeFileInBucket(
                buckets[0].id,
                token,
                filePath
              ).then(function(entry) {
                expect(entry.name).to.equal(randomName + '.txt');
                expect(entry.size).to.equal(16777216);
                expect(entry.mimetype).to.equal('text/plain');
                done();
              }, done);
            }, done);
          }, done);
        });
        randomio.pipe(target);
      });

    });

    describe('GET /buckets/:id/files', function() {

      it('should list the files in the bucket', function(done) {
        client.getBuckets().then(function(buckets) {
          client.listFilesInBucket(buckets[0].id).then(function(files) {
            expect(files).to.have.lengthOf(1);
            done();
          }, done);
        }, done);
      });

    });

    describe('GET /buckets/:id/files/:file', function() {

      it('should return the file pointer payloads for the file', function(done) {
        this.timeout(6000);
        client.getBuckets().then(function(buckets) {
          client.listFilesInBucket(buckets[0].id).then(function(files) {
            client.createToken(buckets[0].id, 'PULL').then(function(token) {
              client.getFilePointer(
                buckets[0].id,
                token.token,
                files[0].id
              ).then(function(pointers) {
                expect(Array.isArray(pointers)).to.equal(true);
                expect(pointers).to.have.lengthOf(2);
                client.resolveFileFromPointers(pointers).then(function(stream) {
                  var bytes = 0;
                  stream.on('data', function(data) {
                    bytes += data.length;
                  });
                  stream.on('end', function() {
                    expect(bytes).to.equal(16777216);
                    done();
                  });
                }, done);
              }, done);
            }, done);
          }, done);
        }, done);
      });

      it('should return an error if file is not found', function(done) {
        client.getBuckets().then(function(buckets) {
          client.createToken(buckets[0].id, 'PULL').then(function(token) {
            client.getFilePointer(
              buckets[0].id,
              token.token,
              '572cf3175355f2635480f94e'
            ).then(function() {
              done(new Error('Error was not returned'));
            }, function(err) {
              expect(err.message).to.equal('File not found');
              done();
            });
          }, done);
        }, done);
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
