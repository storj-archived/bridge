'use strict';

const fs = require('fs');
const sinon = require('sinon');
const expect = require('chai').expect;
const Storage = require('storj-service-storage-models');
const ComplexClient = require('storj-complex').createClient;
const storj = require('storj-lib');
const Monitor = require('../../lib/monitor');
const MonitorConfig = require('../../lib/monitor/config');
const log = require('../../lib/logger');

/* jshint maxstatements: 100 */

describe('Monitor', function() {

  const sandbox = sinon.sandbox.create();
  beforeEach(() => {
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'writeFileSync');
    sandbox.stub(fs, 'readFileSync').returns('{}');
  });
  afterEach(() => sandbox.restore());

  const config = new MonitorConfig('/tmp/storj-monitor-test.json');

  describe('@constructor', function() {

    it('will contruct with new', function() {
      const monitor = new Monitor(config);
      expect(monitor._config).to.equal(config);
      expect(monitor._timeout).to.equal(null);
      expect(monitor._running).to.equal(false);
    });

    it('will contruct without new', function() {
      const monitor = Monitor(config);
      expect(monitor._config).to.equal(config);
      expect(monitor._timeout).to.equal(null);
      expect(monitor._running).to.equal(false);
    });

  });

  describe('#start', function() {

    it('will init storage, network, contracts, and schedule run', function(done) {
      const monitor = new Monitor(config);
      monitor.wait = sandbox.stub();
      monitor.start(function(err) {
        if (err) {
          return done(err);
        }
        expect(monitor.storage).to.be.instanceOf(Storage);
        expect(monitor.network).to.be.instanceOf(ComplexClient);
        expect(monitor.contracts).to.be.instanceOf(storj.StorageManager);
        expect(monitor.wait.callCount).to.equal(1);
        done();
      });
    });

  });

  describe('#run', function() {

    it('will call wait if already running', function() {
      const monitor = new Monitor(config);
      monitor._running = true;
      monitor.wait = sandbox.stub();
      monitor.run();
      expect(monitor.wait.callCount).to.equal(1);
    });


    it('will log error when querying contacts', function() {
      const monitor = new Monitor(config);

      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');


      const exec = sandbox.stub().callsArgWith(0, new Error('Mongo error'));
      const sort = sandbox.stub().returns({
        exec: exec
      });
      const limit = sandbox.stub().returns({
        sort: sort
      });
      const find = sandbox.stub().returns({
        limit: limit
      });

      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };

      monitor.wait = sandbox.stub();
      monitor.run();
      expect(monitor.wait.callCount).to.equal(1);
      expect(monitor._running).to.equal(false);
      expect(log.error.callCount).to.equal(1);
      expect(log.info.callCount).to.equal(2);
    });

    it('will log error when missing contacts', function() {
      const monitor = new Monitor(config);

      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');


      const exec = sandbox.stub().callsArgWith(0, null, null);
      const sort = sandbox.stub().returns({
        exec: exec
      });
      const limit = sandbox.stub().returns({
        sort: sort
      });
      const find = sandbox.stub().returns({
        limit: limit
      });

      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };

      monitor.wait = sandbox.stub();
      monitor.run();
      expect(monitor.wait.callCount).to.equal(1);
      expect(monitor._running).to.equal(false);
      expect(log.error.callCount).to.equal(1);
      expect(log.info.callCount).to.equal(2);
    });

    it('query least seen contacts, log and record status', function() {
      const monitor = new Monitor(config);

      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');
      sandbox.stub(log, 'warn');

      monitor.network = {
        ping: sandbox.stub().callsArgWith(1, new Error('Farmer offline'))
      };
      monitor.network.ping.onThirdCall().callsArgWith(1, null);

      const save = sandbox.stub().callsArg(0);
      save.onSecondCall().callsArgWith(0, new Error('Mongo error'));

      const recordTimeoutFailure = sandbox.stub().returns({
        save: save
      });

      const contacts = [{
        nodeID: '7b8b30132e930c7827ee47efebfb197d6a3246d4',
        address: '127.0.0.1',
        port: 1337,
        recordTimeoutFailure: recordTimeoutFailure,
        timeoutRate: 0.05
      }, {
        nodeID: 'dd985ca22f19858257b3328a56f8f4aabee1d4a1',
        address: '127.0.0.1',
        port: 1337,
        recordTimeoutFailure: recordTimeoutFailure,
        timeoutRate: 0.02
      }, {
        nodeID: '6ae62b18fc9d20139c933e66f3b2fd2f8d04c20d',
        address: '127.0.0.1',
        port: 1337,
        recordTimeoutFailure: recordTimeoutFailure,
        timeoutRate: 0.03
      }];

      const exec = sandbox.stub().callsArgWith(0, null, contacts);
      const sort = sandbox.stub().returns({
        exec: exec
      });
      const limit = sandbox.stub().returns({
        sort: sort
      });
      const find = sandbox.stub().returns({
        limit: limit
      });
      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };
      monitor.wait = sandbox.stub();
      monitor.run();

      expect(find.callCount).to.equal(1);
      expect(find.args[0][0]).to.eql({
        $or: [
          { timeoutRate: { $lt: 0.04 } },
          { timeoutRate: { $exists: false } }
        ]
      });

      expect(sort.callCount).to.equal(1);
      expect(sort.args[0][0]).to.eql({lastSeen: 1});
      expect(monitor.wait.callCount).to.equal(1);
      expect(exec.callCount).to.equal(1);
      expect(limit.callCount).to.equal(1);
      expect(limit.args[0][0]).to.equal(100);

      expect(log.error.callCount).to.equal(3);

      expect(log.error.args[0][1])
        .to.equal('7b8b30132e930c7827ee47efebfb197d6a3246d4');
      expect(log.error.args[0][2])
        .to.equal('Farmer offline');

      expect(log.error.args[1][1])
        .to.equal('dd985ca22f19858257b3328a56f8f4aabee1d4a1');
      expect(log.error.args[1][2])
        .to.equal('Farmer offline');

      expect(log.error.args[2][1])
        .to.equal('dd985ca22f19858257b3328a56f8f4aabee1d4a1');
      expect(log.error.args[2][2])
        .to.equal('Mongo error');

      expect(recordTimeoutFailure.callCount).to.equal(2);
      expect(save.callCount).to.equal(2);

      expect(log.info.callCount).to.equal(2);
      expect(log.warn.callCount).to.equal(1);
      expect(log.warn.args[0][1])
        .to.equal('7b8b30132e930c7827ee47efebfb197d6a3246d4');
      expect(log.warn.args[0][2])
        .to.equal(0.05);

      expect(monitor.network.ping.callCount).to.equal(3);
      expect(monitor.network.ping.args[0][0]).to.be.instanceOf(storj.Contact);
    });

  });

  describe('_randomTime', function() {

    it('will select a random number between min and max', function() {
      const monitor = new Monitor(config);
      const time = monitor._randomTime(600000, 300000);
      expect(time).to.be.above(299999); // 5min
      expect(time).to.be.below(600001); // 10min
    });

    it('will throw with invalid options', function() {
      const monitor = new Monitor(config);
      expect(function() {
        monitor._randomTime(300000, 600000);
      }).to.throw('Assertion');
    });

  });

  describe('#wait', function() {

    it('will set a timeout, and call run', function() {
      const time = sandbox.useFakeTimers();

      const monitor = new Monitor(config);
      monitor.run = sandbox.stub();
      monitor._randomTime = sandbox.stub().returns(1000);
      monitor._timeout = setTimeout(() => {
        throw new Error('This should not happen');
      }, 5);
      monitor.wait();
      time.tick(1001);
      expect(monitor.run.callCount).to.equal(1);
    });

  });

});
