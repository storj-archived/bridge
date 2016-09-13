'use strict';

const storj = require('storj');
const expect = require('chai').expect;
const mongoose = require('mongoose');
const CONSTANTS = require('../../lib/constants');

require('mongoose-types').loadTypes(mongoose);

const DebitSchema = require('../../lib/storage/models/debit');

var Debit;
var connection;


before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__storj-bridge-test',
    function() {
      Debit = DebitSchema(connection);
      done();
    }
  );
});

after(function(done) {
  Debit.remove({}, function() {
    connection.close(done);
  });
});

describe('Storage/models/Debit', function() {
  describe('#create', function() {

    it('should create a debit', function() {
      Debit.create({
        user: 'user1@example.com',
        amount: 1000,
        type: CONSTANTS.DEBIT_TYPES.AUDIT
      }, {}, function(err, debit) {
        expect(err).to.not.be.instanceOf(Error);
        expect(debit).to.be.ok;
        expect(debit.created).to.be.ok;
        expect(debit.user).to.be.a('string');
      })
    });

    it('should not create a debit without an amount', function() {
      Debit.create({
        user: 'user1@example.com',
        type: CONSTANTS.DEBIT_TYPES.AUDIT
      }, {}, function(err, debit) {
        expect(err).to.be.instanceOf(err);
        expect(err.message).to.be.ok;
        expect(debit).to.not.be.ok;
      })
    })

    it('should not create a debit with a non-number amount', function() {
      Debit.create({
        user: 'user1@example.com',
        type: CONSTANTS.DEBIT_TYPES.AUDIT,
        amount: 'test'
      }, {}, function(err, credit) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Debit validation failed');
        expect(debit).to.not.be.ok;
      })
    })

    it('should not create a debit with a string for an amount', function() {
      Debit.create({
        user: 'user1@example.com',
        type: CONSTANTS.DEBIT_TYPES.AUDIT,
        amount: '1000'
      }, {}, function(err, debit) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Debit validation failed');
        expect(debit).to.not.be.ok;
      })
    })

    it('should not create a debit without a user', function() {
      Debit.create({
        amount: 1000,
        type: CONSTANTS.DEBIT_TYPES.AUDIT
      }, {}, function(err, debit) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Debit validation failed');
        expect(debit).to.not.be.ok;
      })
    })

  })
})
