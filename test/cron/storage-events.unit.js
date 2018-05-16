'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const log = require('../../lib/logger');
const proxyquire = require('proxyquire');
const StorageEventsCron = require('../../lib/cron/storage-events');
const EventEmitter = require('events').EventEmitter;
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
    it('will initialize storage, job, and start job', function(done) {
      function Storage(mongoUrl, mongoOpts, options) {
        expect(options).to.eql({logger: log});
        const url = 'mongodb://127.0.0.1:27017/__storj-bridge-test';
        expect(mongoUrl).to.eql(url);
        expect(mongoOpts).to.eql({});
      }
      const TestStorageEventsCron = proxyquire('../../lib/cron/storage-events', {
        'storj-service-storage-models': Storage
      });
      var config = new Config('__tmptest');
      const cron = new TestStorageEventsCron(config);
      cron.start(() => {
        done();
      });
    });
  });

  describe('#updateReputation', function() {
    var config = new Config('__tmptest');
    var sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('will record points and save', function() {
      const cron = new StorageEventsCron(config);
      const contact = {
        recordPoints: sandbox.stub().returns({
          save: sandbox.stub().callsArgWith(0, null)
        })
      };
      cron.storage = {
        models: {
          Contact: {
            findOne: sandbox.stub().callsArgWith(1, null, contact)
          }
        }
      };
      const nodeID = '2c5ae6807e9179cb2174d0265867c63abce48dfb';
      const points = 10;
      cron._updateReputation(nodeID, points);
      expect(cron.storage.models.Contact.findOne.callCount)
        .to.equal(1);
      expect(cron.storage.models.Contact.findOne.args[0][0])
        .to.eql({_id: nodeID});
      expect(contact.recordPoints.callCount).to.equal(1);
    });

    it('will return if contact not found', function() {
      const cron = new StorageEventsCron(config);
      const contact = {
        recordPoints: sandbox.stub().returns({
          save: sandbox.stub().callsArgWith(0, null)
        })
      };
      cron.storage = {
        models: {
          Contact: {
            findOne: sandbox.stub().callsArgWith(1, null, null)
          }
        }
      };
      const nodeID = '2c5ae6807e9179cb2174d0265867c63abce48dfb';
      const points = 10;
      cron._updateReputation(nodeID, points);
      expect(contact.recordPoints.callCount).to.equal(0);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(false);
    });

    it('success: farmer(false), client(true)', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1000
        },
        farmerReport: {
          exchangeResultCode: 1100
        }
      };
      const user = {};
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(false);
    });

    it('success: farmer(unknown), client(true)', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1000
        }
      };
      const user = {};
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(false);
    });

    it('success: farmer(true), client(true)', function() {
      const cron = new StorageEventsCron(config);
      const event = {
        success: false,
        clientReport: {
          exchangeResultCode: 1000
        }
      };
      const user = {};
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(false);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(false);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(false);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(true);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(true);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(true);
      expect(unknown).to.equal(true);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(true);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(true);
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
      const {success, unknown} = cron._resolveCodes(event, user);
      expect(success).to.equal(false);
      expect(unknown).to.equal(true);
    });

  });

  describe('#_resolveEvent', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    var config = new Config('__tmptest');
    it('handle error from user find query', function(done) {
      const cron = new StorageEventsCron(config);
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, new Error('test'))
          }
        }
      };
      const event = {
        user: 'user@domain.tld',
      };
      cron._resolveEvent(event, (err, timestamp) => {
        expect(err.message).to.equal('test');
        expect(timestamp).to.equal(undefined);
        done();
      });
    });
    it('save and record reputation points (success)', function(done) {
      const cron = new StorageEventsCron(config);
      sandbox.stub(cron, '_updateReputation');
      const user = {
        updateUnknownReports: sandbox.stub().callsArgWith(3)
      };
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, null, user)
          }
        }
      };
      cron._resolveCodes = sandbox.stub().returns({
        success: true,
        unknown: false
      });
      const now = new Date();
      const farmerID = '359b6436d4fd934b55cff8c55388e529e4f09f0c';
      const event = {
        user: 'user@domain.tld',
        timestamp: now,
        success: false,
        save: sandbox.stub().callsArgWith(0),
        farmer: farmerID
      };
      cron._resolveEvent(event, (err, timestamp) => {
        if (err) {
          return done(err);
        }
        expect(event.save.callCount).to.equal(1);
        expect(event.success).to.equal(true);
        expect(cron._updateReputation.callCount).to.equal(1);
        expect(cron._updateReputation.args[0][0]).to.equal(farmerID);
        expect(cron._updateReputation.args[0][1]).to.equal(1);
        expect(timestamp).to.equal(now);
        expect(event.processed).to.equal(true);
        done();
      });
    });
    it('save and record reputation points (failure)', function(done) {
      const cron = new StorageEventsCron(config);
      sandbox.stub(cron, '_updateReputation');
      const user = {
        updateUnknownReports: sandbox.stub().callsArgWith(3)
      };
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, null, user)
          }
        }
      };
      cron._resolveCodes = sandbox.stub().returns({
        success: false,
        unknown: false
      });
      const now = new Date();
      const farmerID = '359b6436d4fd934b55cff8c55388e529e4f09f0c';
      const event = {
        user: 'user@domain.tld',
        timestamp: now,
        success: false,
        save: sandbox.stub().callsArgWith(0),
        farmer: farmerID
      };
      cron._resolveEvent(event, (err, timestamp) => {
        if (err) {
          return done(err);
        }
        expect(event.save.callCount).to.equal(1);
        expect(event.success).to.equal(false);
        expect(cron._updateReputation.callCount).to.equal(1);
        expect(cron._updateReputation.args[0][0]).to.equal(farmerID);
        expect(cron._updateReputation.args[0][1]).to.equal(-1);
        expect(timestamp).to.equal(now);
        expect(event.processed).to.equal(true);
        done();
      });
    });
    it('will handle error from saving event status', function(done) {
      const cron = new StorageEventsCron(config);
      sandbox.stub(cron, '_updateReputation');
      const user = {
        updateUnknownReports: sandbox.stub().callsArgWith(3)
      };
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, null, user)
          }
        }
      };
      cron._resolveCodes = sandbox.stub().returns({
        success: true,
        unknown: false
      });
      const now = new Date();
      const event = {
        user: 'user@domain.tld',
        timestamp: now,
        success: false,
        save: sandbox.stub().callsArgWith(0, new Error('test'))
      };
      cron._resolveEvent(event, (err, timestamp) => {
        expect(err.message).to.equal('test');
        expect(timestamp).to.equal(undefined);
        done();
      });
    });
    it.skip('will give reputation points', function() {
    });
    it('will update user unknown report rates (with storage)', function(done) {
      const cron = new StorageEventsCron(config);
      sandbox.stub(cron, '_updateReputation');
      const user = {
        updateUnknownReports: sandbox.stub().callsArgWith(3)
      };
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, null, user)
          }
        }
      };
      const unknown = false;
      cron._resolveCodes = sandbox.stub().returns({
        success: true,
        unknown: unknown
      });
      const now = new Date();
      const event = {
        user: 'user@domain.tld',
        timestamp: now,
        success: false,
        save: sandbox.stub().callsArgWith(0),
        storage: 10000
      };
      cron._resolveEvent(event, (err, timestamp) => {
        expect(user.updateUnknownReports.callCount).to.equal(1);
        expect(user.updateUnknownReports.args[0][0]).to.equal(unknown);
        expect(user.updateUnknownReports.args[0][1]).to.equal(now);
        expect(user.updateUnknownReports.args[0][2]).to.equal(10000);
        expect(timestamp).to.equal(now);
        done();
      });
    });
    it('will update user unknown report rates (with bandwidth)', function(done) {
      const cron = new StorageEventsCron(config);
      sandbox.stub(cron, '_updateReputation');
      const user = {
        updateUnknownReports: sandbox.stub().callsArgWith(3)
      };
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, null, user)
          }
        }
      };
      const unknown = false;
      cron._resolveCodes = sandbox.stub().returns({
        success: true,
        unknown: unknown
      });
      const now = new Date();
      const event = {
        user: 'user@domain.tld',
        timestamp: now,
        success: false,
        save: sandbox.stub().callsArgWith(0),
        downloadBandwidth: 11000
      };
      cron._resolveEvent(event, (err, timestamp) => {
        expect(user.updateUnknownReports.callCount).to.equal(1);
        expect(user.updateUnknownReports.args[0][0]).to.equal(unknown);
        expect(user.updateUnknownReports.args[0][1]).to.equal(now);
        expect(user.updateUnknownReports.args[0][2]).to.equal(11000);
        expect(timestamp).to.equal(now);
        done();
      });
    });
    it('will handle error from user unknown report update', function(done) {
      const cron = new StorageEventsCron(config);
      sandbox.stub(cron, '_updateReputation');
      const user = {
        updateUnknownReports: sandbox.stub().callsArgWith(3, new Error('test'))
      };
      cron.storage = {
        models: {
          User: {
            findOne: sandbox.stub().callsArgWith(1, null, user)
          }
        }
      };
      const unknown = false;
      cron._resolveCodes = sandbox.stub().returns({
        success: true,
        unknown: unknown
      });
      const now = new Date();
      const event = {
        user: 'user@domain.tld',
        timestamp: now,
        success: false,
        save: sandbox.stub().callsArgWith(0)
      };
      cron._resolveEvent(event, (err, timestamp) => {
        expect(err.message).to.equal('test');
        expect(timestamp).to.equal(undefined);
        done();
      });
    });
  });

  describe('#_run', function() {
    var config = new Config('__tmptest');
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('it will close cursor and stop on timeout', function(done) {
      const clock = sandbox.useFakeTimers();
      const cron = new StorageEventsCron(config);
      const cursor = new EventEmitter();
      cursor.close = sandbox.stub();
      cron.storage = {
        models: {
          StorageEvent: {
            find: sandbox.stub().returns({
              sort: sandbox.stub().returns({
                cursor: sandbox.stub().returns(cursor)
              })
            })
          }
        }
      };
      const timestamp = new Date();
      cron._run(timestamp, (err) => {
        expect(err.message).to.equal('Job exceeded max duration');
        done();
      });
      clock.tick(StorageEventsCron.MAX_RUN_TIME + 1);
    });

    it('it will resolve each event', function(done) {
      const cron = new StorageEventsCron(config);
      cron._resolveEvent = sandbox.stub();
      const cursor = new EventEmitter();
      cursor.close = sandbox.stub();
      cursor.pause = sandbox.stub();
      cron.storage = {
        models: {
          StorageEvent: {
            find: sandbox.stub().returns({
              sort: sandbox.stub().returns({
                cursor: sandbox.stub().returns(cursor)
              })
            })
          }
        }
      };
      const timestamp = new Date();
      const events = [
        {
          'token': 'f571c06a871857b3fb38187875609ec5718acd0b',
        },
        {
          'token': '688a4efc515f17967ac809f963e54e1024beab41'
        },
        {
          'token': 'd2f399c8fa5039b10b35e73d826e43d34c00453f'
        }
      ];
      cron._run(timestamp, (err) => {
        if (err) {
          return done(err);
        }
        expect(cron._resolveEvent.callCount).to.equal(3);
        expect(cron._resolveEvent.args[0][0]).to.equal(events[0]);
        expect(cron._resolveEvent.args[1][0]).to.equal(events[1]);
        expect(cron._resolveEvent.args[2][0]).to.equal(events[2]);
        done();
      });
      events.forEach((event) => {
        cursor.emit('data', event);
      });
      cursor.emit('end');
    });
  });

  describe('#run', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());
    var config = new Config('__tmptest');

    it('will handle error from lock', function() {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      sandbox.stub(log, 'info');
      const cron = new StorageEventsCron(config);
      cron._run = sandbox.stub();
      cron.storage = {
        models: {
          CronJob: {
            lock: sandbox.stub().callsArgWith(2, new Error('test'))
          }
        }
      };
      cron.run();
      expect(log.error.callCount).to.equal(1);
      expect(log.error.args[0][0]).to.match(/lock failed/);
      expect(cron._run.callCount).to.equal(0);
    });

    it('will bail if lock can not be acquired', function() {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      sandbox.stub(log, 'info');
      const cron = new StorageEventsCron(config);
      cron._run = sandbox.stub();
      cron.storage = {
        models: {
          CronJob: {
            lock: sandbox.stub().callsArgWith(2, null, false)
          }
        }
      };
      cron.run();
      expect(log.warn.callCount).to.equal(1);
      expect(log.warn.args[0][0]).to.match(/already running/);
      expect(cron._run.callCount).to.equal(0);
    });

    it('will log error from _run and unlock ', function() {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      sandbox.stub(log, 'info');
      const cron = new StorageEventsCron(config);
      cron._run = sandbox.stub().callsArgWith(1, new Error('test'));
      cron.storage = {
        models: {
          CronJob: {
            lock: sandbox.stub().callsArgWith(2, null, true),
            unlock: sandbox.stub().callsArgWith(2, null)
          }
        }
      };
      cron.run();
      expect(log.error.callCount).to.equal(1);
      expect(log.error.args[0][0]).to.match(/Error running/);
      expect(cron.storage.models.CronJob.lock.callCount).to.equal(1);
      expect(cron.storage.models.CronJob.unlock.callCount).to.equal(1);
      expect(cron._run.callCount).to.equal(1);
    });

    it('will call _run with lastTimestamp from lock and unlock', function() {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      sandbox.stub(log, 'info');
      const now = new Date();
      const then = new Date(now.getTime() + 100000);
      const cron = new StorageEventsCron(config);
      cron._run = sandbox.stub().callsArgWith(1, null, then);
      const res = {
        value: {
          rawData: {
            lastTimestamp: now.getTime()
          }
        }
      };
      const unlock = sandbox.stub().callsArgWith(2, null);
      cron.storage = {
        models: {
          CronJob: {
            lock: sandbox.stub().callsArgWith(2, null, true, res),
            unlock: unlock
          }
        }
      };
      cron.run();
      expect(cron._run.callCount).to.equal(1);
      expect(cron._run.args[0][0]).to.be.instanceOf(Date);
      expect(cron._run.args[0][0]).to.eql(now);
      expect(unlock.callCount).to.equal(1);
      expect(unlock.args[0][0]).to.equal('StorageEventsFinalityCron');
      expect(unlock.args[0][1]).to.eql({
        lastTimestamp: then.getTime()
      });
    });

    it('will log error from unlock', function() {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      sandbox.stub(log, 'info');
      const timestamp = new Date().toISOString();
      const cron = new StorageEventsCron(config);
      cron._run = sandbox.stub().callsArgWith(1, new Error('test'));
      const res = {
        value: {
          rawData: {
            lastTimestamp: timestamp
          }
        }
      };
      const unlock = sandbox.stub().callsArgWith(2, new Error('test'));
      cron.storage = {
        models: {
          CronJob: {
            lock: sandbox.stub().callsArgWith(2, null, true, res),
            unlock: unlock
          }
        }
      };
      cron.run();
      expect(unlock.callCount).to.equal(1);
      expect(unlock.args[0][0]).to.equal('StorageEventsFinalityCron');
    });
  });

});
