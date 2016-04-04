'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const expect = require('chai').expect;

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

    before(function() {
      if (fs.existsSync(path.join(CONFDIR, '__tmptest'))) {
        fs.unlinkSync(path.join(CONFDIR, '__tmptest'));
      }
    });

    it('should create a config instance with the defaults', function() {
      var config = new Config('__tmptest');
      expect(JSON.stringify(config)).to.equal(JSON.stringify(Config.DEFAULTS));
    });

    it('should create the config file', function() {
      Config('__tmptest');
      expect(fs.existsSync(path.join(CONFDIR, '__tmptest'))).to.equal(true);
    });

  });

});
