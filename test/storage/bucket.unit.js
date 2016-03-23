'use strict';

const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const BucketSchema = require('../../lib/storage/models/bucket');

var Bucket;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__metadisk-test',
    function() {
      Bucket = BucketSchema(connection);
      done();
    }
  );
});

after(function(done) {
  Bucket.remove({}, function() {
    connection.close(done);
  });
});

describe('Storage/models/Bucket', function() {

  describe('#create', function() {

    it('should create the bucket with the default props', function(done) {
      Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
        expect(err).to.equal(null);
        expect(bucket.storage).to.equal(10);
        expect(bucket.transfer).to.equal(30);
        Bucket.findOne({ _id: bucket.id }, function(err, bucket) {
          expect(bucket.storage).to.equal(10);
          expect(bucket.transfer).to.equal(30);
          expect(bucket.status).to.equal('Active');
          expect(bucket.name).to.equal('New Bucket');
          expect(bucket.pubkeys).to.have.lengthOf(0);
          expect(bucket.user).to.equal('user@domain.tld');
          done();
        });
      });
    });

    it('should create the bucket with the given props', function(done) {
      Bucket.create({ _id: 'user@domain.tld' }, {
        storage: 30,
        transfer: 50,
        name: 'My Bucket'
      }, function(err, bucket) {
        expect(err).to.equal(null);
        Bucket.findOne({ _id: bucket.id }, function(err, bucket) {
          expect(bucket.storage).to.equal(30);
          expect(bucket.transfer).to.equal(50);
          expect(bucket.status).to.equal('Active');
          expect(bucket.name).to.equal('My Bucket');
          expect(bucket.pubkeys).to.have.lengthOf(0);
          expect(bucket.user).to.equal('user@domain.tld');
          done();
        });
      });
    });

  });

});
