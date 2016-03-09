'use strict';

const storj = require('storj');
const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const FileSchema = require('../../lib/storage/models/file');
const BucketSchema = require('../../lib/storage/models/bucket');

var FilePointer;
var Bucket;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__metadisk-test',
    function() {
      FilePointer = FileSchema(connection);
      Bucket = BucketSchema(connection);
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

describe('Storage/models/File', function() {

  it('should create the file metadata', function(done) {
    Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
      var file = new FilePointer({
        _id: storj.utils.rmd160sha256('file'),
        bucket: bucket.id,
        filename: 'file.txt',
        size: Buffer('file').length
      });
      file.save(function(err) {
        expect(err).to.not.be.instanceOf(Error);
        done();
      });
    });
  });

  it('should fail with invalid mimetype', function(done) {
    Bucket.create({ _id: 'user@domain.tld' }, {}, function(err, bucket) {
      var file = new FilePointer({
        _id: storj.utils.rmd160sha256('invalid'),
        bucket: bucket.id,
        mimetype: 'invalid/mimetype',
        filename: 'invalid.txt',
        size: Buffer('invalid').length
      });
      file.save(function(err) {
        expect(err).to.be.instanceOf(Error);
        done();
      });
    });
  });

});
