'use strict';

const fs = require('fs');
const sinon = require('sinon');
const expect = require('chai').expect;
const MonitorConfig = require('../../lib/monitor/config');

describe('Monitor Config', function() {

  const sandbox = sinon.sandbox.create();
  let readFileSync;
  let writeFileSync;
  let mkdirSync;
  let existsSync;
  beforeEach(() => {
    existsSync = sandbox.stub(fs, 'existsSync').returns(false);
    writeFileSync = sandbox.stub(fs, 'writeFileSync');
    readFileSync = sandbox.stub(fs, 'readFileSync').returns('{}');
    mkdirSync = sandbox.stub(fs, 'mkdirSync');
  });
  afterEach(() => sandbox.restore());

  describe('@constructor', function() {

    function checkConfig(config) {
      expect(config);
      expect(config.storage);
      expect(config.complex);
      expect(config.logger);
      expect(config.application);
      expect(config.application.maxInterval);
      expect(config.application.minInterval);
      expect(config.application.queryNumber);
      expect(config.application.pingConcurrency);
    }

    it('will contruct with/without new', function() {
      let config = new MonitorConfig('/tmp/storj-monitor-test.json');
      checkConfig(config);
      config = MonitorConfig('/tmp/storj-monitor-test.json');
      checkConfig(config);
    });

    it('will get paths, setup and merge', function() {
      readFileSync.restore();
      sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({
        application: {
          pingConcurrency: 100
        }
      }));
      sandbox.spy(MonitorConfig, 'getPaths');
      sandbox.spy(MonitorConfig, 'setupConfig');
      let config = new MonitorConfig('/tmp/storj-monitor-test.json');
      expect(MonitorConfig.getPaths.callCount).to.equal(1);
      expect(MonitorConfig.setupConfig.callCount).to.equal(1);
      expect(config.application.pingConcurrency).to.equal(100);
    });

    it('will construct without args', function() {
      const config = new MonitorConfig();
      expect(config);
    });

    it('will construct with environment variables', function() {
      process.env.storjmonitor_logger__level = 1;
      const config = new MonitorConfig();
      delete process.env.storjmonitor_logger__level;
      expect(config.logger.level).to.equal(1);
    });

    it('will construct with json environment variables', function() {
      const mongoOpts = {
        connectTimeoutMS: 123456,
        socketTimeoutMS: 123456,
        ssl: true
      };
      process.env.storjmonitor_storage__mongoOpts = JSON.stringify(mongoOpts);
      const config = new MonitorConfig();
      delete process.env.storjmonitor_storage__mongoOpts;
      expect(config.storage.mongoOpts).to.eql(mongoOpts);
    });

    it('json environment variables (boolean and numbers)', function() {
      const mongoOpts = {
        connectTimeoutMS: 123456,
        socketTimeoutMS: 123456,
        ssl: true
      };
      process.env.storjmonitor_storage__mongoOpts__connectTimeoutMS = '123456';
      process.env.storjmonitor_storage__mongoOpts__socketTimeoutMS = '123456';
      process.env.storjmonitor_storage__mongoOpts__ssl = 'true';
      const config = new MonitorConfig();
      delete process.env.storjmonitor_storage__mongoOpts__connectTimeoutMS;
      delete process.env.storjmonitor_storage__mongoOpts__socketTimeoutMS;
      delete process.env.storjmonitor_storage__mongoOpts__ssl;
      expect(config.storage.mongoOpts).to.eql(mongoOpts);
    });

  });

  describe('#getPaths', function() {

    it('will throw if not an absolute config path', function() {
      expect(function() {
        MonitorConfig.getPaths('tmp/storj-monitor-test.json');
      }).to.throw('Assertion');
    });

    it('will get the directory name from path', function() {
      const paths = MonitorConfig.getPaths('/tmp/storj-monitor-test.json');
      expect(paths.confdir).to.equal('/tmp');
      expect(paths.confpath).to.equal('/tmp/storj-monitor-test.json');
    });

  });

  describe('#setupConfig', function() {

    const DEFAULTS = {
      storage: {
        mongoUrl: 'mongodb://127.0.0.1:27017/__storj-bridge-test',
        mongoOpts: {}
      },
      complex: {
        rpcUrl: 'http://localhost:8080',
        rpcUser: 'user',
        rpcPassword: 'pass'
      },
      logger: {
        level: 3
      },
      application: {
        maxInterval: '10m',
        minInterval: '5m',
        queryNumber: 100,
        pingConcurrency: 10,
        timeoutRateThreshold: 0.04
      }
    };

    it('will make directory and create default config', function() {
      MonitorConfig.setupConfig({
        confdir: '/tmp/storj',
        confpath: '/tmp/storj/storj-monitor-config-test.json'
      });
      expect(existsSync.callCount).to.equal(2);
      expect(mkdirSync.callCount).to.equal(1);
      expect(writeFileSync.callCount).to.equal(1);
      expect(writeFileSync.args[0][0])
        .to.equal('/tmp/storj/storj-monitor-config-test.json');
      const conf = writeFileSync.args[0][1];
      expect(conf).to.equal(JSON.stringify(DEFAULTS, null, 2));
    });

  });

});
