'use strict'

const fork = require('process').fork;
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const AuditQueue = require('../../lib/audit/queue.js');

var popSpy = sinon.spy(AuditQueue.prototype, 'populateReadyQueue');
var forkStub = sinon.stub();
var stubQueue = Object.assign(AuditQueue, {populateReadyQueue: popSpy});
const AuditService = proxyquire('../../lib/audit', {
  '../../lib/audit/queue.js': stubQueue,
  child_process: {
    fork: forkStub
  }
});

const Config = require('../../lib/config')('devel').audits;

var service;
var config;

describe('audit/index.js', function() {
  before(function() {
    sinon.spy(AuditService.prototype, 'pollBacklog');
  });

  describe('@constructor', function() {
    it('should not call #pollBacklog if polling option disabled', function() {
      config = Object.assign({}, Config);
      config.polling = undefined;
      service = new AuditService(config);
      expect(service.pollBacklog.called).to.be.false;
    });

    it('should call #pollBacklog if polling option enabled', function() {
      config = Object.assign({}, Config);
      config.polling.interval = 500;
      service = new AuditService(config);
      expect(service.pollBacklog.called).to.be.true;
    });

    it('should call #addNewWorkerToQueue for each worker option',
      function() {
        sinon.spy(AuditService.prototype, 'addNewWorkerToQueue');
        config = Object.assign({}, Config);
        service = new AuditService(config);
        expect(service._options.workers.length)
          .to.equal(service.addNewWorkerToQueue.callCount);
        AuditService.prototype.addNewWorkerToQueue.restore();
    });

    it('should repoll at a configured interval', function(done) {
      this.timeout(1000);
      AuditService.prototype.pollBacklog.restore();
      sinon.spy(AuditService.prototype, 'pollBacklog');
      config = Object.assign({}, Config);
      config.polling.interval = 500;
      service = new AuditService(config);
      setTimeout(testPolled, config.polling.interval + 100);

      function testPolled() {
        expect(service.pollBacklog.calledTwice).to.be.true;
        done();
      }
    });
  });

  describe('#addNewWorkerToQueue', function() {
    config = Object.assign({}, Config);
    service = new AuditService(config);
    it('should fork a process for each optional worker', function() {
      expect(service._options.workers.length === forkStub.callCount);
    });

    it('should restart workers on failure', function(done) {
      this.timeout(550);
      var uuid = config.workers[0].uuid;
      service._workers[uuid].kill();
      expect(service._workers[uuid].killed).to.be.true;
      setTimeout(testRestart, 500);

      function testRestart() {
        expect(service._workers[uuid].killed).to.be.false;
        done();
      }
    });
  });

  describe('#pollBacklog', function() {
    config = Object.assign({}, Config);
    config.polling.interval = 500;
    config.polling.padding = 100;
    service = new AuditService(config);

    it('should accept a current time padding',
      function() {
        expect(service.pollBacklog.args[0] === offset).to.be.true;

    });

    it('should call populateReadyQueue',
      function() {
        expect(service._masterPollQueue.populateReadyQueue.called).to.be.true;
    });

    it('should call populateReadyQueue with padding',
      function() {
        expect(service._masterPollQueue.populateReadyQueue.args[1])
          .to.equal(config.polling.padding);
    });
  });
});
