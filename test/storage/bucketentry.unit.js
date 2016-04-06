'use strict';

const storj = require('storj');
const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const FileSchema = require('../../lib/storage/models/file');
const BucketSchema = require('../../lib/storage/models/bucket');
const BucketEntrySchema = require('../../lib/storage/models/bucketentry');

var FilePointer;
var Bucket;
var BucketEntry;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__storj-bridge-test',
    function() {
      FilePointer = FileSchema(connection);
      Bucket = BucketSchema(connection);
      BucketEntry = BucketEntrySchema(connection);
      done();
    }
  );
});

after(function(done) {
  FilePointer.remove({}, function() {
    Bucket.remove({}, function() {
      connection.close(done);
    });
  });
});

describe('Storage/models/BucketEntry', function() {

  it('should create the bucket entry metadata', function(done) {
    Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
      var file = new FilePointer({
        _id: storj.utils.rmd160sha256('file'),
        size: Buffer('file').length
      });
      file.save(function(err) {
        expect(err).to.not.be.instanceOf(Error);
        var entry = new BucketEntry({
          file: file.hash,
          bucket: bucket._id,
          filename: 'test.txt'
        });
        entry.save(done);
      });
    });
  });

  it('should fail with invalid mimetype', function(done) {
    Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
      var file = new FilePointer({
        _id: storj.utils.rmd160sha256('new file'),
        size: Buffer('new file').length
      });
      file.save(function(err) {
        expect(err).to.not.be.instanceOf(Error);
        var entry = new BucketEntry({
          file: file.hash,
          mimetype: 'invalid/mimetype',
          bucket: bucket._id,
          filename: 'test.txt'
        });
        entry.save(function(err) {
          expect(err).to.be.instanceOf(Error);
          done();
        });
      });
    });
  });

});
