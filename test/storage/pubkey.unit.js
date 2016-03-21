'use strict';

const storj = require('storj');
const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const PublicKeySchema = require('../../lib/storage/models/pubkey');

var PublicKey;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__metadisk-test',
    function() {
      PublicKey = PublicKeySchema(connection);
      done();
    }
  );
});

after(function(done) {
  PublicKey.remove({}, function() {
    connection.close(done);
  });
});

describe('Storage/models/PublicKey', function() {

  it('should create the public key', function(done) {
    var publicKey = storj.KeyPair().getPublicKey();
    PublicKey.create({
      _id: 'user@domain.tld'
    }, publicKey, function(err, pubkey) {
      expect(err).to.not.be.instanceOf(Error);
      expect(pubkey._id).to.equal(publicKey);
      done();
    });
  });

  it('should reject an invalid ecdsa key', function(done) {
    PublicKey.create({
      _id: 'user@domain.tld'
    }, 'testkey', function(err) {
      expect(err).to.be.instanceOf(Error);
      done();
    });
  });

  it('should reject an invalid hex string', function(done) {
    PublicKey.create(
      {
        _id: 'user@domain.tld'
      },
      '02:3d:9e:3d:b5:e0:b0:1b:be:5d:5a:66:6c:47:d6:87:43:60:8b:2c:ec:70:87:eb:56:37:95:1f:51:e8:61:a7:fd',
    function(err) {
      expect(err.message).to.equal(
        'Invalid public key supplied: Must not contain non-hexidecimal characters like ":"'
      );
      done();
    });
  });

});
