'use strict';

const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const TokenSchema = require('../../lib/storage/models/token');
const BucketSchema = require('../../lib/storage/models/bucket');

var Token;
var Bucket;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__metadisk-test',
    function() {
      Token = TokenSchema(connection);
      Bucket = BucketSchema(connection);
      done();
    }
  );
});

after(function(done) {
  Token.remove({}, function() {
    Bucket.remove({}, function() {
      connection.close(done);
    });
  });
});

describe('Storage/models/Token', function() {

  describe('#create', function() {

    it('should create the token for the bucket', function(done) {
      Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
        Token.create(bucket, 'PUSH', function(err, token) {
          expect(err).to.not.be.instanceOf(Error);
          expect(token.bucket.toString()).to.equal(bucket.id);
          expect(token.operation).to.equal('PUSH');
          done();
        });
      });
    });

    it('should not create the token for invalid operation', function(done) {
      Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
        Token.create(bucket, 'Push', function(err) {
          expect(err.message).to.equal('Token validation failed');
          done();
        });
      });
    });

  });

  describe('#generate', function() {

    it('should generate a random unique token', function() {
      expect(Token.generate()).to.have.lengthOf(64);
    });

  });

  describe('#lookup', function() {

    it('should return the token object', function(done) {
      Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
        Token.create(bucket, 'PUSH', function(err, token) {
          expect(err).to.not.be.instanceOf(Error);
          Token.lookup(token.token, function(err, result) {
            expect(err).to.not.be.instanceOf(Error);
            expect(token.token).to.equal(result.token);
            done();
          });
        });
      });
    });

  });

});
