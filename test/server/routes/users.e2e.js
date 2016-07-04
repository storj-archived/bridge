'use strict';

const methods = require('http').METHODS;
const DatabaseCleaner = require('database-cleaner');
const superagent = require('superagent');
const Factory = require('factory-lady');

const cleanMongo = function(fn) {
  const dbCleaner = new DatabaseCleaner('mongodb');
  const mongodb = require('mongodb');
  mongodb.connect('mongodb://localhost/__storj-bridge-test', function(err, db) {
    if (err) {
      throw new Error(err);
    } else {
      dbCleaner.clean(db, fn);
    }
  });
};

const expect = require('chai').expect;
const storjBridge = require('../../../bin/storj-bridge');
const crypto = require('crypto');
const request = methods.reduce(function(requestObj, method) {
  const methodLower = method.toLowerCase();
  requestObj[methodLower] = function(path) {
    return superagent[methodLower]('http://localhost:6382' + path);
  };
  return requestObj;
}, {});

const newPassword = function() {
  const clear = 'cleartext_' + crypto.randomBytes(8).toString('hex');
  return {
    clear: clear,
    hash: crypto.createHash('sha256').update(clear).digest('hex')
  };
};

const boot = function(fn) {
  return function(done) {
    /*
     * POLL UNTIL SERVER HAS STARTED
     */
    const intervalId = setInterval(function() {
      if (storjBridge.server && storjBridge.server.server) {
        clearInterval(intervalId);
        console.info('server ready!');
        fn(storjBridge, done);
      } else {
        console.info('waiting for server...');
      }
    }, 100);
  };
};

context('After boot', function() {
  let models;

  before(boot(function(storjBridge, done) {
    models = storjBridge.storage.models;
    Factory.define('user', storjBridge.storage.models.User, {});

    cleanMongo(done);
  }));

  afterEach(function(done) {
    cleanMongo(done);
  });

  describe('POST /users', function() {
    const userData = {
      email: 'testymctesterson@example.tld',
      password: newPassword().hash
    };
    let response;

    before(function(done) {
      request
          .post('/users')
          .send(userData)
          .end(function(err, res) {
            if (err) {
              throw new Error(err);
            }
            response = res;
            done();
          });
    });

    it('should create a new user', function(done) {
      models.User.findOne({
        _id: userData.email
      }, function(err, user) {
        if (err) {
          throw new Error(err);
        }
        expect(err).to.equal(null);
        expect(user.email).to.eql(userData.email);
        done();
      });
    });

    it('should return status 200', function() {
      expect(response.status).to.equal(200);
    });
  });
});
