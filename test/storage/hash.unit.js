'use strict';

const storj = require('storj');
const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const FileSchema = require('../../lib/storage/models/file');
const BucketSchema = require('../../lib/storage/models/bucket');
const HashSchema = require('../../lib/storage/models/hash');

var FilePointer;
var Bucket;
var Hash;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__storj-bridge-test',
    function() {
      FilePointer = FileSchema(connection);
      Bucket = BucketSchema(connection);
      Hash = HashSchema(connection);
      done();
    }
  );
});

after(function(done) {
  FilePointer.remove({}, function() {
    Bucket.remove({}, function() {
      Hash.remove({}, function() {
        connection.close(done);
      });
    });
  });
});

describe('Storage/models/Hash', function() {

  it('should create the hash metadata', function(done) {
    var file = new FilePointer({
      _id: storj.utils.rmd160sha256('somefile'),
      size: Buffer('somefile').length
    });
    file.save(function(err) {
      expect(err).to.not.be.instanceOf(Error);
      Hash.create(file, storj.utils.rmd160sha256('somefile'), 0, done);
    });
  });

});
