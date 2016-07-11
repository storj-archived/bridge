'use strict'

const fork = require('process').fork;
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const AuditQueue = require('../../lib/audit/queue.js');
const inherits = require('util').inherits;
var popSpy = sinon.spy(AuditQueue.prototype, 'populateReadyQueue');
var forkStub = function() {
  return {
    on: sinon.stub()
  }
}

var AuditService = proxyquire('../../lib/audit', {
  '../../lib/audit/queue.js': AuditQueue,
  'child_process': {
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
  });

  describe('#pollBacklog', function() {
    config = Object.assign({}, Config);
    config.polling.interval = 500;
    config.polling.padding = 100;
    service = new AuditService(config);

    it('should accept a current time padding',
      function() {
        expect(service.pollBacklog.getCall(1).args[0]
          === config.polling.padding).to.be.true;
    });

    it('should call populateReadyQueue',
      function() {
        expect(service._masterPollQueue.populateReadyQueue.called).to.be.true;
    });
  });
});
