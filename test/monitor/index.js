'use strict';

const expect = require('chai').expect;
const Monitor = require('../lib/monitor');

describe('Monitor', function() {

  describe('@constructor', function() {

    it('will contruct with/without new', function() {
    });

    it('will set the correct properties', function() {
    });

  });

  describe('#start', function() {

    it('will init storage, network, contracts, and schedule run', function(done) {
    });

  });

  describe('#run', function() {

    it('will query the "n" least seen contacts', function() {
    });

    it('will record the last ping time', function() {
    });

    it('will trigger replication if not seen for "n" amonut of time', function() {
    });

  });

  describe('#_replicate', function() {

    it('will invalidate a contract and mirror', function() {
    });

    it('will trigger a new mirror to be created', function() {
    });
  });

  describe('_randomTime', function() {

    it('will select a random number between min and max', function() {
    });

    it('will throw with invalid options', function() {
    });

  });

  describe('#wait', function() {

    it('will set a timeout, and call run', function() {
    });

  });

  describe('#_handleUncaughtException', function() {

    it('will log stack trace of exception', function() {
    });

  });

  describe('#_handleSIGINT', function() {

    it('will wait to shutdown until nolonger actively running', function() {
    });

  });

});
