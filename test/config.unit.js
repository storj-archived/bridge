'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const expect = require('chai').expect;
const sinon = require('sinon');

const Config = require('..').Config;

describe('Config', function() {

  const ENV = process.env;
  const PLATFORM = os.platform();
  const DIRNAME = '.storj-bridge';
  const HOME = PLATFORM === 'win32' ? ENV.USER_PROFILE : ENV.HOME;
  const DATADIR = path.join(HOME, DIRNAME);
  const CONFDIR = path.join(DATADIR, 'config');
  const ITEMDIR = path.join(DATADIR, 'items');

  describe('@module', function() {

    it('should create the datadir if it does not exist', function() {
      expect(fs.existsSync(CONFDIR)).to.equal(true);
      expect(fs.existsSync(ITEMDIR)).to.equal(true);
    });

  });

  describe('@constructor', function() {
    var sandbox = sinon.sandbox.create();

    before(function() {
      if (fs.existsSync(path.join(CONFDIR, '__tmptest'))) {
        fs.unlinkSync(path.join(CONFDIR, '__tmptest'));
      }
    });

    afterEach(function() {
      sandbox.restore();
    });

    it('should create a config instance with the defaults', function() {
      var config = new Config('__tmptest');
      delete config._;
      delete config.recursive;
      expect(JSON.stringify(config)).to.equal(JSON.stringify(Config.DEFAULTS));
    });

    it('should create the config file', function() {
      Config('__tmptest');
      expect(fs.existsSync(path.join(CONFDIR, '__tmptest'))).to.equal(true);
    });

    it('should create without args', function() {
      const config = new Config();
      expect(config);
    });

    it('will construct with environment variables', function() {
      process.env.storjbridge_logger__level = 1;
      const config = new Config();
      delete process.env.storjbridge_logger__level;
      expect(config.logger.level).to.equal(1);
    });

    it('will construct with json environment variables', function() {
      const mongoOpts = {
        connectTimeoutMS: 123456,
        socketTimeoutMS: 123456,
        ssl: true
      };
      process.env.storjbridge_storage__mongoOpts = JSON.stringify(mongoOpts);
      const config = new Config();
      delete process.env.storjbridge_storage__mongoOpts;
      expect(config.storage.mongoOpts).to.eql(mongoOpts);
    });

    it('json environment variables (boolean and numbers)', function() {
      const mongoOpts = {
        connectTimeoutMS: 123456,
        socketTimeoutMS: 123456,
        ssl: true
      };
      process.env.storjbridge_storage__mongoOpts__connectTimeoutMS = '123456';
      process.env.storjbridge_storage__mongoOpts__socketTimeoutMS = '123456';
      process.env.storjbridge_storage__mongoOpts__ssl = 'true';
      const config = new Config();
      delete process.env.storjbridge_storage__mongoOpts__connectTimeoutMS;
      delete process.env.storjbridge_storage__mongoOpts__socketTimeoutMS;
      delete process.env.storjbridge_storage__mongoOpts__ssl;
      expect(config.storage.mongoOpts).to.eql(mongoOpts);
    });

    it('will create from an object', function() {
      sandbox.stub(Config, 'getPaths');
      sandbox.stub(Config, 'setupDataDirectory');
      sandbox.stub(Config, 'setupConfig');
      var options = {
        hello: 'world'
      };
      var config = new Config(options);
      expect(config.hello).to.equal('world');
      expect(config.application);
      expect(config.storage);
      expect(config.server);
      expect(config.complex);
      expect(config.logger);
      expect(config.mailer);
    });

  });

  describe('@setupDataDirectory', function() {
    function runTest() {
      var paths = {
        datadir: '/tmp/storj-test-' + crypto.randomBytes(4).toString('hex')
      };
      Config.setupDataDirectory(paths);
      expect(fs.existsSync(paths.datadir)).to.equal(true);
      expect(fs.existsSync(paths.datadir + '/items')).to.equal(true);
    }
    it('will make directory if it does not exist', function() {
      runTest();
    });
    it('will NOT make directory if it already exists', function() {
      runTest();
    });
  });

  describe('@setupConfig', function() {
    function runTest() {
      var confdir = '/tmp/storj-testconf-' + crypto.randomBytes(4).toString('hex');
      var paths = {
        confdir: confdir,
        confpath: confdir + '/develop'
      };
      Config.setupConfig(paths);
      expect(fs.existsSync(paths.confdir)).to.equal(true);
      expect(fs.existsSync(paths.confpath)).to.equal(true);
    }
    it('will create config directory and file if does not exist', function() {
      runTest();
    });
    it('will NOT create config directory and file exists', function() {
      runTest();
    });
  });

  describe('@getPaths', function() {
    it('it will use defaults if confpath and datadir are undefined', function() {
      var paths = Config.getPaths('development');
      expect(paths.datadir).to.equal(process.env.HOME + '/.storj-bridge');
      expect(paths.confdir).to.equal(process.env.HOME + '/.storj-bridge/config');
      expect(paths.confpath).to.equal(process.env.HOME + '/.storj-bridge/config/development');
    });
    it('it will use confpath and datadir if defined', function() {
      var paths = Config.getPaths('development', '/tmp/etc/storj/bridge', '/tmp/var/storj/bridge');
      expect(paths.datadir).to.equal('/tmp/var/storj/bridge');
      expect(paths.confdir).to.equal('/tmp/etc/storj');
      expect(paths.confpath).to.equal('/tmp/etc/storj/bridge');
    });
    it('it will use datadir and default config directory', function() {
      var paths = Config.getPaths('development', null, '/tmp/var/storj/bridge');
      expect(paths.datadir).to.equal('/tmp/var/storj/bridge');
      expect(paths.confdir).to.equal('/tmp/var/storj/bridge/config');
      expect(paths.confpath).to.equal('/tmp/var/storj/bridge/config/development');
    });
    it('it will use confpath and default datadir', function() {
      var paths = Config.getPaths('development', '/tmp/etc/storj/bridge', null);
      expect(paths.datadir).to.equal(process.env.HOME + '/.storj-bridge');
      expect(paths.confdir).to.equal('/tmp/etc/storj');
      expect(paths.confpath).to.equal('/tmp/etc/storj/bridge');
    });
    it('will throw if datadir and missing env', function() {
      expect(function() {
        Config.getPaths(null, null, '/tmp/var/storj/bridge');
      }).to.throw('env is expected without config path');
    });
    it('will throw datadir is not absolute', function() {
      expect(function() {
        Config.getPaths(null, null, 'tmp/var/storj/bridge');
      }).to.throw('datadir is expected to be absolute');
    });
    it('will throw confpath is not absolute', function() {
      expect(function() {
        Config.getPaths(null, 'tmp/etc/storj/bridge', null);
      }).to.throw('confpath is expected to be absolute');
    });
  });

});
