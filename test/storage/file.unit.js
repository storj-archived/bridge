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
    var file = new FilePointer({
      _id: storj.utils.rmd160sha256('another file'),
      size: Buffer('another file').length
    });
    file.save(function(err) {
      expect(err).to.not.be.instanceOf(Error);
      done();
    });
  });

});
