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

});
