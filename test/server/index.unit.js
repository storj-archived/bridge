'use strict';

var sinon = require('sinon');
var expect = require('chai').expect;
var Server = require('../../lib/server');
var proxyquire = require('proxyquire');

describe('Server', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(Server({ port: 0 }, sinon.stub())).to.be.instanceOf(Server);
    });

  });

  describe('#isConfiguredForSSL', function() {

    it('should return false if ssl is not set', function() {
      var server = new Server({ port: 0 }, sinon.stub());
      expect(server.isConfiguredForSSL()).to.equal(false);
    });

  });

  describe('#_createServer', function() {

    it('should create SSL server if option specified', function() {
      var _createServer = sinon.stub().returns({
        listen: sinon.stub()
      });
      var StubbedServer = proxyquire('../../lib/server', {
        https: {
          createServer: _createServer
        },
        fs: {
          readFileSync: sinon.stub()
        }
      });
      sinon.stub(StubbedServer.prototype, 'isConfiguredForSSL').returns(true);
      StubbedServer({
        port: 0,
        ssl: { key: '', cert: '', ca: [''] }
      }, sinon.stub());
      expect(_createServer.called).to.equal(true);
    });

  });

});

