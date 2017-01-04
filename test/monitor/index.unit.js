'use strict';

const fs = require('fs');
const sinon = require('sinon');
const expect = require('chai').expect;
const Monitor = require('../../lib/monitor');
const MonitorConfig = require('../../lib/monitor/config');

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

    it('will init storage, network, contracts, and schedule run', function() {
    });

  });

  describe('#run', function() {

    it('will query the "n" least seen contacts', function() {
    });

    it('will record the last ping time', function() {
    });

    it('will replication if not seen for "n" amonut of time', function() {
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
        throw new Error('This should not happen')
      }, 5);
      monitor.wait();
      time.tick(1001);
      expect(monitor.run.callCount).to.equal(1);
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
