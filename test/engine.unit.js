'use strict';

const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const Engine = require('..').Engine;
const Config = require('..').Config;
const Storage = require('storj-service-storage-models');
const Mailer = require('storj-service-mailer');
const middleware = require('storj-service-middleware');
const log = require('../lib/logger');
const Server = require('..').Server;
const redis = require('redis');
const EventEmitter = require('events').EventEmitter;

describe('Engine', function() {

  describe('@constructor', function() {

    it('should create instance without the new keyword', function() {
      expect(Engine(Config('__tmptest'))).to.be.instanceOf(Engine);
    });

    it('should keep reference to config', function() {
      var config = Config('__tmptest');
      var engine = new Engine(config);
      expect(engine._config).to.equal(config);
    });

  });

  describe('#_countPendingResponses', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('will return pending count', function() {
      var config = Config('__tmptest');
      var engine = new Engine(config);

      engine._pendingResponses = {
        'one': [
          { destroyed: false },
          { finished: false }
        ],
        'two': [
          { destroyed: true },
          { finished: true }
        ],
        'three': [
          { destroyed: true },
          { finished: false }
        ]
      };

      const count = engine._countPendingResponses();
      expect(count).to.equal(1);
      expect(Object.keys(engine._pendingResponses).length).to.equal(1);
    });
  });

  describe('#_logHealthInfo', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    /* jshint ignore:start */ // ignore for too many function statements
    it('will handle error', function() {
      var config = Config('__tmptest');
      var engine = new Engine(config);

      sandbox.stub(log, 'info');
      engine.server = {
        server: {
          listening: true,
          getConnections: sandbox.stub().callsArgWith(0, new Error('test'))
        }
      };
      engine.storage = {
        connection: {
          readyState: 1
        }
      };
      engine.redis = redis.createClient();
      engine._countPendingResponses = sinon.stub().returns(10);
      engine._logHealthInfo();
      expect(log.info.callCount).to.equal(1);
      expect(log.info.args[0][0]).to.equal('%j');

      const report = log.info.args[0][1].bridge_health_report;
      expect(report.error).to.equal('test');
      expect(report.connections).to.equal(undefined);

      expect(report.pid);
      expect(report.cpuUsage);
      expect(report.cpuDiff);
      expect(report.memory);
      expect(report.heapStatistics);
      expect(report.heapSpaceStatistics);
      expect(report.uptime);
      expect(report.listening).to.equal(true);
      expect(report.pendingResponses).to.equal(10);
      expect(report.databaseState).to.equal(1);
    });
    /* jshint ignore:end */

    it('will log health information', function() {
      var config = Config('__tmptest');
      var engine = new Engine(config);

      sandbox.stub(log, 'info');
      engine.server = {
        server: {
          listening: true,
          getConnections: sandbox.stub().callsArgWith(0, null, 12)
        }
      };
      engine.storage = {
        connection: {
          readyState: 1
        }
      };
      engine.redis = redis.createClient();
      engine._countPendingResponses = sinon.stub().returns(10);
      engine._logHealthInfo();
      expect(log.info.callCount).to.equal(1);
      expect(log.info.args[0][0]).to.equal('%j');

      const report = log.info.args[0][1].bridge_health_report;
      expect(report.pid);
      expect(report.cpuUsage);
      expect(report.memory);
      expect(report.heapStatistics);
      expect(report.heapSpaceStatistics);
      expect(report.uptime);
      expect(report.listening).to.equal(true);
      expect(report.connections).to.equal(12);
      expect(report.pendingResponses).to.equal(10);
      expect(report.databaseState).to.equal(1);
    });

  });

  describe('#getSpecification', function() {

    var config = Config('__tmptest');
    var engine = new Engine(config);

    it('should return the swagger specification', function() {
      var spec = engine.getSpecification();
      expect(typeof spec).to.equal('object');
    });

    it('should return the cached swagger specification', function() {
      expect(engine._apispec).to.equal(engine.getSpecification());
    });

  });

  describe('#start', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should setup storage, mailer, server', function(done) {
      const clock = sandbox.useFakeTimers();

      var config = Config('__tmptest');
      var engine = new Engine(config);
      engine._logHealthInfo = sinon.stub();
      engine.start(function(err) {
        expect(err).to.equal(undefined);
        expect(engine.storage).to.be.instanceOf(Storage);
        expect(engine.mailer).to.be.instanceOf(Mailer);
        expect(engine.server).to.be.instanceOf(Server);
        expect(engine.redis).to.be.instanceOf(redis.RedisClient);
        expect(engine._healthInterval);
        clock.tick(Engine.HEALTH_INTERVAL + 10);
        expect(engine._logHealthInfo.callCount).to.equal(1);
        engine.server.server.close(function() {
          done();
        });
      });
    });

    it('should handle redis error event', () => {
      const redisStub = new EventEmitter();
      sandbox.stub(redis, 'createClient').returns(redisStub);
      sandbox.stub(log, 'error');

      const config = Config('__tmptest');
      const engine = new Engine(config);
      engine.start(function() {
        redisStub.emit('error', new Error('Test!'));
        expect(log.error.callCount).to.equal(1);
      });
    });

  });

  describe('#_configureApp', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('it should use middleware error handler', function(done) {
      const use = sandbox.stub();
      const express = sandbox.stub().returns({
        use: use,
        get: sandbox.stub()
      });
      const TestEngine = proxyquire('../lib/engine', {
        express: express
      });
      const errorhandler = function(err, req, res, next) {
        next();
      };
      sandbox.stub(middleware, 'errorhandler').returns(errorhandler);
      sandbox.stub(Server, 'Routes').returns([]);
      var config = Config('__tmptest');
      var engine = new TestEngine(config);
      engine._configureApp();
      expect(middleware.errorhandler.callCount).to.equal(1);
      expect(use.args[2][0]).to.equal(errorhandler);
      done();
    });

  });

  describe('#_handleRootGET', function() {

    it('should respond with the api specification', function(done) {
      var config = Config('__tmptest');
      var engine = new Engine(config);
      engine._handleRootGET({}, {
        send: function(content) {
          expect(content).to.equal(engine.getSpecification());
          done();
        }
      });
    });

  });

  describe('#_trackResponseStatus', function() {

    it('should store reference to response', function(done) {
      var engine = new Engine(Config('__tmptest'));
      var resp = {};
      var sock = {};
      engine._trackResponseStatus({ socket: sock }, resp, function() {
        var key = Object.keys(engine._pendingResponses)[0];
        expect(engine._pendingResponses[key][0]).to.equal(sock);
        expect(engine._pendingResponses[key][1]).to.equal(resp);
        done();
      });
    });

  });

  describe('#_keepPendingResponsesClean', function() {

    it('should delete responses that are finished', function(done) {
      var engine = new Engine(Config('__tmptest'));
      engine._pendingResponses = {
        one: [{ destroyed: false }, { finished: false }],
        two: [{ destroyed: true }, { finished: true }],
        three: [{ destroyed: true }, { finished: false }]
      };
      var clock = sinon.useFakeTimers();
      engine._keepPendingResponsesClean();
      clock.tick(Engine.RESPONSE_CLEAN_INTERVAL);
      expect(engine._pendingResponses.two).to.equal(undefined);
      expect(engine._pendingResponses.one).to.not.equal(undefined);
      clock.restore();
      done();
    });

  });

});
