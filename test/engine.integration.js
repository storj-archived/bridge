'use strict';

const fs = require('fs');
const noisegen = require('noisegen');
const crypto = require('crypto');
const expect = require('chai').expect;
const storj = require('storj');
const async = require('async');
const develop = require('../script/develop');
const Storage = require('../lib/storage');
const Config = require('../lib/config');

describe('Engine/Integration', function() {

  var environment, storage;
  var keypair = storj.KeyPair();
  var client = storj.BridgeClient('http://127.0.0.1:6382');

  before(function(done) {
    console.log('                                    ');
    console.log('  ********************************  ');
    console.log('  * SPINNING UP TEST ENVIRONMENT *  ');
    console.log('  *       GRAB A COCKTAIL!       *  ');
    console.log('  ********************************  ');
    console.log('  (this can take up to 30 seconds)  ');
    console.log('                                    ');
    this.timeout(60000);
    storage = Storage(Config.DEFAULTS.storage);
    storage.connection.on('connected', function() {
      async.forEachOf(storage.models, function(model, name, done) {
        model.remove({}, done);
      }, function() {
        environment = develop(function() {
          setTimeout(done, 20000);
        });
      });
    });
  });

  after(function(done) {
    environment.kill(done);
  });

  describe('UsersRouter', function() {

    describe('POST /users', function() {

      let keypair = storj.KeyPair();

      it('should register the user account', function(done) {
        client.createUser({
          email: 'test@domain.tld',
          password: 'password'
        }, function(err, user) {
          expect(user.email).to.equal('test@domain.tld');
          expect(user.activated).to.equal(false);
          done(err);
        });
      });

      it('should register the user account with a pubkey', function(done) {
        client.createUser({
          email: 'test2@domain.tld',
          password: 'password',
          pubkey: keypair.getPublicKey()
        }, function(err, result) {
          expect(result.pubkey).to.equal(keypair.getPublicKey());
          done(err);
        });
      });

      it('should fail to use inactive user account basicauth', function(done) {
        let tmpclient = storj.BridgeClient('http://127.0.0.1:6382', {
          basicauth: {
            email: 'test2@domain.tld',
            password: 'password'
          }
        });
        tmpclient.getPublicKeys(function(err) {
          expect(err.message).to.equal('User account has not been activated');
          done();
        });
      });

      it('should fail to use inactive user account pubkey', function(done) {
        let tmpclient = storj.BridgeClient('http://127.0.0.1:6382', {
          keypair: keypair
        });
        tmpclient.getPublicKeys(function(err) {
          expect(err.message).to.equal('User account has not been activated');
          done();
        });
      });

      it('should not create duplicate key', function(done) {
        client.createUser({
          email: 'test4@domain.tld',
          password: 'password',
          pubkey: keypair.getPublicKey()
        }, function(err) {
          expect(err.message).to.equal(
            'Public key is already registered'
          );
          done();
        });
      });

      it('should reject an invalid ecdsa key', function(done) {
        client.createUser({
          email: 'test5@domain.tld',
          password: 'password',
          pubkey: 'testkey'
        }, function(err) {
          expect(err.message).to.equal(
            'Invalid public key supplied: Invalid hex string'
          );
          done();
        });
      });

    });

    describe('POST /activations/:token', function() {

      it('should fail to activate the user with invalid token', function(done) {
        client._request('GET', '/activations/INVALID', {}, function(err) {
          expect(err.message).to.equal('Invalid activation token');
          done();
        });
      });

      it('should activate the user account', function(done) {
        storage.models.User.findOne({}, function(err, user) {
          client._request('GET', '/activations/' + user.activator, {}, function(err, user) {
            expect(user.activated).to.equal(true);
            done();
          }, done);
        });
      });

    });

    describe('DELETE /users/:id', function() {

      before(function(done) {
        let client = new storj.BridgeClient('http://127.0.0.1:6382');
        client.createUser({
          email: 'deaduser@killme.com',
          password: 'password'
        }, function(err) {
          if (err) {
            return done(err);
          }
          storage.models.User.findOne({
            _id: 'deaduser@killme.com'
          }, function(err, user) {
            client._request('GET', '/activations/' + user.activator, {}, function() {
              done();
            });
          });
        });
      });

      it('should prepare the account for deactivation', function(done) {
        let client = new storj.BridgeClient('http://127.0.0.1:6382', {
          basicauth: { email: 'deaduser@killme.com', password: 'password' }
        });
        client.destroyUser({ email: 'deaduser@killme.com' }, function(err) {
          expect(err).to.equal(null);
          done();
        });
      });

    });

  });

  describe('PublicKeysRouter', function() {

    describe('POST /keys', function() {

      before(function() {
        client = storj.BridgeClient('http://127.0.0.1:6382', {
          basicauth: {
            email: 'test@domain.tld',
            password: 'password'
          }
        });
      });

      it('should register the public key for the user', function(done) {
        client.addPublicKey(keypair.getPublicKey(), function(err, pubkey) {
          expect(pubkey.key).to.equal(keypair.getPublicKey());
          done();
        });
      });

      after(function() {
        client = storj.BridgeClient('http://127.0.0.1:6382', {
          keypair: keypair,
          logger: require('..').logger
        });
      });

    });

    describe('GET /keys', function() {

      it('should list the registered keys for the user', function(done) {
        client.getPublicKeys(function(err, keys) {
          expect(keys).to.have.lengthOf(1);
          done();
        });
      });

    });

    describe('DELETE /keys/:pubkey', function() {

      it('should invalidate the supplied public key', function(done) {
        client.addPublicKey(storj.KeyPair().getPublicKey(), function(err, key) {
          client.destroyPublicKey(key.key, function(err, result) {
            expect(result).to.equal(undefined);
            client.getPublicKeys(function(err, keys) {
              expect(keys).to.have.lengthOf(1);
              done();
            });
          });
        });
      });

    });

  });

  describe('BucketsRouter', function() {

    describe('POST /buckets', function() {

      it('should create a new bucket', function(done) {
        client.createBucket({
          name: 'Test Bucket'
        }, function(rtt, bucket) {
          expect(bucket.name).to.equal('Test Bucket');
          done();
        });
      });

      it('should allow duplicate key', function(done) {
        client.createBucket({
          name: 'Test Bucket duplicate key',
          pubkeys: [ keypair.getPublicKey() ]
        }, function(err, bucket) {
          expect(bucket.name).to.equal('Test Bucket duplicate key');
          expect(bucket.pubkeys).to.have.lengthOf(1);
          expect(bucket.pubkeys[0]).to.equal(keypair.getPublicKey());
          done();
        });
      });

      it('should reject a duplicate name', function(done) {
        client.createBucket({
          name: 'Test Bucket'
        }, function(err) {
          expect(err.message).to.equal(
            'Name already used by another bucket'
          );
          done();
        });
      });

      it('should reject an invalid ecdsa key', function(done) {
        client.createBucket({
          name: 'Test Bucket invalid ecdsa key',
          pubkeys: [ 'testkey' ]
        }, function(err) {
          expect(err.message).to.equal(
            'Invalid public key supplied'
          );
          done();
        });
      });

    });

    describe('GET /buckets', function() {

      it('should return a list of buckets', function(done) {
        client.getBuckets(function(err, buckets) {
          expect(buckets).to.have.lengthOf(2);
          done();
        });
      });

    });

    describe('GET /buckets/:id', function() {

      it('should return the bucket by the supplied ID', function(done) {
        client.getBuckets(function(err, buckets) {
          client.getBucketById(buckets[0].id, function(err, bucket) {
            expect(bucket.id).to.equal(buckets[0].id);
            done();
          });
        });
      });

    });

    describe('PATCH /buckets/:id', function() {

      it('should update the bucket information', function(done) {
        client.getBuckets(function(err, buckets) {
          client.updateBucketById(buckets[0].id, {
            storage: 3
          }, function(err, bucket) {
            expect(bucket.storage).to.equal(3);
            done();
          });
        });
      });

      it('should update the bucket information', function(done) {
        client.getBuckets(function(err, buckets) {
          client.updateBucketById(buckets[0].id, {
            pubkeys: [ 'testkey' ]
          }, function(err) {
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
        }, function(err, bucket) {
          expect(bucket.name).to.equal('Marked For Death');
          client.destroyBucketById(bucket.id, function() {
            client.getBuckets(function(err, buckets) {
              expect(buckets).to.have.lengthOf(2);
              done();
            });
          });
        });
      });

    });

    describe('POST /buckets/:id/tokens', function() {

      it('should create a PULL token for the bucket', function(done) {
        client.getBuckets(function(err, buckets) {
          client.createToken(buckets[0].id, 'PULL', function(err, token) {
            expect(token.operation).to.equal('PULL');
            expect(token.bucket).to.equal(buckets[0].id);
            done();
          });
        });
      });

      it('should create a PUSH token for the bucket', function(done) {
        client.getBuckets(function(err, buckets) {
          client.createToken(buckets[0].id, 'PUSH', function(err, token) {
            expect(token.operation).to.equal('PUSH');
            expect(token.bucket).to.equal(buckets[0].id);
            done();
          });
        });
      });

      it('should allow authorized unregistered key create token', function(done) {
        client.getBuckets(function(err, buckets) {
          let unregkp = storj.KeyPair();
          client.updateBucketById(buckets[0].id, {
            pubkeys: buckets[0].pubkeys.concat([unregkp.getPublicKey()])
          }, function(err, bucket) {
            let tmpclient = storj.BridgeClient('http://127.0.0.1:6382', {
              keypair: unregkp
            });
            tmpclient.createToken(bucket.id, 'PULL', function(err, token) {
              expect(token.operation).to.equal('PULL');
              expect(token.bucket).to.equal(bucket.id);
              done();
            });
          });
        });
      });

      it('should not allow unauthorized key create token', function(done) {
        client.getBuckets(function(err, buckets) {
          let unregkp = storj.KeyPair();
          let tmpclient = storj.BridgeClient('http://127.0.0.1:6382', {
            keypair: unregkp
          });
          tmpclient.createToken(buckets[0].id, 'PULL', function(err) {
            expect(err.message).to.equal('Bucket not found');
            done();
          });
        });
      });

    });

    describe('POST /buckets/:bucket_id/files', function() {

      it('should store the file in the bucket', function(done) {
        this.timeout(60000);
        var randomName = crypto.randomBytes(6).toString('hex');
        var filePath = require('os').tmpdir() + '/' + randomName + '.txt';
        var randomio = noisegen({ length: 1024 * 1024 * 16 });
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
                  expect(entry.name).to.equal(randomName + '.txt');
                  expect(entry.size).to.equal(16777216);
                  expect(entry.mimetype).to.equal('text/plain');
                  done();
                }
              );
            });
          });
        });
        randomio.pipe(target);
      });

    });

    describe('GET /buckets/:id/files', function() {

      it('should list the files in the bucket', function(done) {
        client.getBuckets(function(err, buckets) {
          client.listFilesInBucket(buckets[0].id, function(err, files) {
            expect(files).to.have.lengthOf(1);
            done();
          });
        });
      });

    });

    describe('POST /buckets/:bucket_id/mirrors', function() {

      it('should create n mirror farmers', function(done) {
        this.timeout(60000);
        client.getBuckets(function(err, buckets) {
          client.listFilesInBucket(buckets[0].id, function(err, files) {
            expect(files).to.have.lengthOf(1);
            client.replicateFileFromBucket(
              buckets[0].id,
              files[0].id,
              2,
              function(err, results) {
                expect(err).to.equal(null);
                expect(results).to.have.lengthOf(2);
                expect(results[0].mirrors).to.have.lengthOf(2);
                expect(results[1].mirrors).to.have.lengthOf(2);
                done();
              }
            );
          });
        });
      });

    });

    describe('GET /buckets/:id/files/:file', function() {

      it('should return the file pointer payloads for the file', function(done) {
        this.timeout(6000);
        client.getBuckets(function(err, buckets) {
          if (err) { return done(err); }
          client.listFilesInBucket(buckets[0].id, function(err, files) {
            if (err) { return done(err); }
            client.createToken(buckets[0].id, 'PULL', function(err, token) {
              if (err) { return done(err); }
              client.getFilePointers({
                bucket: buckets[0].id,
                token: token.token,
                file: files[0].id
              }, function(err, pointers) {
                  if (err) { return done(err); }
                  expect(Array.isArray(pointers)).to.equal(true);
                  expect(pointers).to.have.lengthOf(2);
                  client.resolveFileFromPointers(pointers, function(err, stream) {
                    if (err) { return done(err); }
                    var bytes = 0;
                    stream.on('data', function(data) {
                      bytes += data.length;
                    });
                    stream.on('end', function() {
                      expect(bytes).to.equal(16777216);
                      done();
                    });
                  });
                }
              );
            });
          });
        });
      });

      it('should return an error if file is not found', function(done) {
        client.getBuckets(function(err, buckets) {
          client.createToken(buckets[0].id, 'PULL', function(err, token) {
            client.getFilePointers({
              bucket: buckets[0].id,
              token: token.token,
              file: '572cf3175355f2635480f94e'
            }, function(err) {
                expect(err.message).to.equal('File not found');
                done();
              }
            );
          });
        });
      });

    });

  });

  describe('Authentication/PublicKey', function() {

    it('should verify the signature', function(done) {
      var kp = storj.KeyPair();
      var newclient = storj.BridgeClient('http://127.0.0.1:6382', {
        keypair: kp
      });
      client.addPublicKey(kp.getPublicKey(), function() {
        newclient.getPublicKeys(function(err, keys) {
          expect(Array.isArray(keys)).to.equal(true);
          done();
        });
      });
    });

  });

});
