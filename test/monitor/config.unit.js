'use strict';

const fs = require('fs');
const sinon = require('sinon');
const expect = require('chai').expect;
const MonitorConfig = require('../../lib/monitor/config');

describe('Monitor Config', function() {

  const sandbox = sinon.sandbox.create();
  beforeEach(() => {
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'writeFileSync');
    sandbox.stub(fs, 'readFileSync').returns('{}');
  });
  afterEach(() => sandbox.restore());

  describe('@constructor', function() {

    it('will contruct with/without new', function() {
      const config = new MonitorConfig('/tmp/storj-monitor-test.json');
      expect(config);
    });

    it('will setup default config, and merge with defaults', function() {
    });

    it('will set the correct properties', function() {
    });

  });

  describe('#getPaths', function() {

    it('will throw if not an absolute config path', function() {
    });

    it('will get the directory name from path', function() {
    });

  });

  describe('#setupConfig', function() {

    it('will make directory and create default config', function() {
    });

  });

});
