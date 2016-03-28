'use strict';

const crypto = require('crypto');
const expect = require('chai').expect;
const mongoose = require('mongoose');

require('mongoose-types').loadTypes(mongoose);

const UserSchema = require('../../lib/storage/models/user');

var User;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__metadisk-test',
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

function sha256(i) {
  return crypto.createHash('sha256').update(i).digest('hex');
}

describe('Storage/models/User', function() {

  describe('#create', function() {

    it('should create the user account in inactive state', function(done) {
      User.create('user@domain.tld', sha256('password'), function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.activated).to.equal(false);
        done();
      });
    });

    it('should not create a duplicate user account', function(done) {
      User.create('user@domain.tld', sha256('password'), function(err) {
        expect(err.message).to.equal('Email is already registered');
        done();
      });
    });

    it('should not create a invalid email', function(done) {
      User.create('wrong@domain', sha256('password'), function(err) {
        expect(err.message).to.equal('User validation failed');
        done();
      });
    });

    it('should not create a user account with bad password', function(done) {
      User.create('wrong@domain.tld', 'password', function(err) {
        expect(err.message).to.equal('Password must be hex encoded SHA-256 hash');
        done();
      });
    });

  });

  describe('#activate', function() {

    it('should activate the user account', function(done) {
      User.findOne({}, function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.activated).to.equal(false);
        user.activate(function() {
          expect(user.activated).to.equal(true);
          done();
        });
      });
    });

  });

  describe('#deactivate', function() {

    it('should activate the user account', function(done) {
      User.findOne({}, function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.activated).to.equal(true);
        user.deactivate(function() {
          expect(user.activated).to.equal(false);
          done();
        });
      });
    });

  });

  describe('#lookup', function() {

    it('should return the user account', function(done) {
      User.lookup('user@domain.tld', sha256('password'), function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.id).to.equal('user@domain.tld');
        done();
      });
    });

  });

});
