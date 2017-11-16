'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const StorageEventsCron = require('../../lib/cron/storage-events');
const Config = require('../../lib/config');

describe('StorageEventsCron', function() {
  describe('@constructor', function() {
    it('will initialize', function() {
      var config = new Config('__tmptest');
      const cron = new StorageEventsCron(config);
      expect(cron._config);
    });
  });

  describe('#start', function() {
    it('will initialize storage, job, and start job', function() {

    });
  });

  describe('#_resolveCodes', function() {
    var config = new Config('__tmptest');
    it('failed: farmer(false), client(unknown)', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {},
        farmerReport: {
          exchangeResultCode: 1100
        }
      };
      const user = {};
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(false);
      expect(successModified).to.equal(false);
    });

    it('failed: farmer(false), client(false)', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1100
        },
        farmerReport: {
          exchangeResultCode: 1100
        }
      };
      const user = {};
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(false);
      expect(successModified).to.equal(false);
    });

    it('failed: farmer(unknown), client(false)', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1100
        },
        farmerReport: {}
      };
      const user = {};
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(false);
      expect(successModified).to.equal(false);
    });

    it('success: farmer(true), client(false), > threshold', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1100
        },
        farmerReport: {
          exchangeResultCode: 1000
        }
      };
      const user = {
        exceedsUnknownReportsThreshold: sinon.stub().returns(true)
      };
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(true);
      expect(successModified).to.equal(true);
    });

    it('success: farmer(unknown), client(unknown), > threshold', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {},
        farmerReport: {}
      };
      const user = {
        exceedsUnknownReportsThreshold: sinon.stub().returns(true)
      };
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(true);
      expect(successModified).to.equal(true);
    });

    it('success: farmer(true), client(false), > threshold', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1100
        },
        farmerReport: {
          exchangeResultCode: 1000
        }
      };
      const user = {
        exceedsUnknownReportsThreshold: sinon.stub().returns(true)
      };
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(true);
      expect(successModified).to.equal(true);
    });

    it('failed: farmer(true), client(false), < threshold', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1100
        },
        farmerReport: {
          exchangeResultCode: 1000
        }
      };
      const user = {
        exceedsUnknownReportsThreshold: sinon.stub().returns(false)
      };
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(true);
      expect(successModified).to.equal(false);
    });

    it('failed: farmer(unknown), client(unknown), < threshold', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {},
        farmerReport: {}
      };
      const user = {
        exceedsUnknownReportsThreshold: sinon.stub().returns(false)
      };
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(true);
      expect(successModified).to.equal(false);
    });

    it('failed: farmer(true), client(unknown), < threshold', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {},
        farmerReport: {
          exchangeResultCode: 1000
        }
      };
      const user = {
        exceedsUnknownReportsThreshold: sinon.stub().returns(false)
      };
      const {success, successModified, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(true);
      expect(successModified).to.equal(false);
    });

  });

  describe('#_resolveEvent', function() {
    it('handle error from user find query', function() {

    });
    it('save update event status', function() {

    });
    it('will handle error from saving event status', function() {

    });
    it('will give reputation points', function() {

    });
    it('will update user unknown report rates', function() {

    });
    it('will handle error from user unknown report update', function() {

    });
  });

  describe('#_run', function() {
    it('it will close cursor and stop on timeout', function() {

    });

    it('it will resolve each event', function() {
    });
  });

  describe('#run', function() {
    it('will handle error from lock', function() {

    });

    it('will bail if lock can not be acquired', function() {

    });

    it('will log error from _run and unlock ', function() {

    });

    it('will call _run with lastTimestamp from lock and unlock', function() {

    });

    it('will log error from unlock', function() {

    });

  });

});
