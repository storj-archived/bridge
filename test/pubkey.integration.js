'use strict';

const expect = require('chai').expect;
const bridge = require('storj-bridge-client');
const mongoose = require('mongoose');

const UserSchema = require('../lib/storage/models/user');

var User;
var connection;
var client = bridge.Client('http://127.0.0.1:6382');
var keypair = bridge.KeyPair();

describe('PublicKey/Integration', function() {

  before(function(done) {
    connection = mongoose.createConnection(
      'mongodb://127.0.0.1:27017/__storj-bridge-test',
      function() {
        User = UserSchema(connection);
        done();
      }
    );
  });

  after(function(done) {
    User.remove({}, function() {
      connection.close(done);
    });
  });

  describe('POST /users', function() {

    it('should register the user account with a pubkey', function(done) {
      client.createUser(
        'test@domain.tld',
        'password',
        null,
        keypair.getPublicKey()
      ).then(function(result) {
        expect(result.pubkey).to.equal(keypair.getPublicKey());
        client = bridge.Client('http://127.0.0.1:6382', {
          keypair: keypair
        });
        User.findOne({}, function(err, user) {
          user.activate(function() {
            expect(user.activated).to.equal(true);
            client.getPublicKeys().then(function(keys) {
              expect(keys).to.have.lengthOf(1);
              done();
            }, done);
          });
        });
      }, done);
    });

    it('should not create duplicate key', function(done) {
      client.createUser(
        'test2@domain.tld',
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
        'test3@domain.tld',
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

  describe('POST /buckets', function() {

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

  describe('PATCH /buckets/:id', function() {

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

});
