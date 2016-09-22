'use strict'

const fork = require('process').fork;
const expect = require('chai').expect;
const sinon = require('sinon');
const clone = require('merge').clone;
const proxyquire = require('proxyquire');
const AuditQueue = require('../../../../lib/audit/adapters/redis/queue.js');
const Config = require('../../../../lib/config')('devel').audits;

var popSpy = sinon.spy(AuditQueue.prototype, 'populateReadyQueue');
var forkStub = function() {
  return {
    on: sinon.stub()
  }
}

var AuditService = proxyquire('../../../../lib/audit/adapters/redis/service.js',
 {
  '../../../../lib/audit/adapters/redis/queue.js': AuditQueue,
  'child_process': {
    fork: forkStub
  }
});

var service;
var config;

describe('audit/adapters/redis/service', function() {
  beforeEach(function() {
    sinon.spy(AuditService.prototype, 'pollBacklog');
  });

  afterEach(function() {
    AuditService.prototype.pollBacklog.restore();
  });

  describe('@constructor', function() {
    before(function() {
      sinon.spy(AuditService.prototype, 'addNewWorkerToQueue');
    });

    it('should not call #pollBacklog if polling option disabled', function() {
      config = clone(Config);
      config.adapter.polling = undefined;
      service = new AuditService(config);
      expect(service.pollBacklog.called).to.be.false;
    });

    it('should call #pollBacklog if polling option enabled', function() {
      config = clone(Config);
      config.adapter.polling = {
        interval: 500,
        padding: 0
      };

      service = new AuditService(config);
      expect(service.pollBacklog.called).to.be.true;
    });

    it('should call #addNewWorkerToQueue for each worker option',
      function() {
        AuditService.prototype.addNewWorkerToQueue.restore();
        sinon.spy(AuditService.prototype, 'addNewWorkerToQueue');
        config = clone(Config);
        service = new AuditService(config);
        expect(service._options.workers.length)
          .to.equal(service.addNewWorkerToQueue.callCount);
        AuditService.prototype.addNewWorkerToQueue.restore();
    });

    it('should repoll at a configured interval', function(done) {
      this.timeout(1000);
      config = clone(Config);
      config.adapter.polling.interval = 500;
      service = new AuditService(config);
      setTimeout(testPolled, config.adapter.polling.interval + 100);

      function testPolled() {
        expect(service.pollBacklog.calledTwice).to.be.true;
        done();
      }
    });
  });

  describe('#addNewWorkerToQueue', function() {
    before(function() {
      config = clone(Config);
      service = new AuditService(config);
    });

    it('should fork a process for each optional worker', function() {
      expect(service._options.workers.length === forkStub.callCount);
    });
  });

  describe('#pollBacklog', function() {
    it('should accept a current time padding',
      function() {
        config = clone(Config);
        config.adapter.polling.interval = 500;
        config.adapter.polling.padding = 100;
        service = new AuditService(config);
        expect(service.pollBacklog.getCall(0).args[0]
          === config.adapter.polling.padding).to.be.true;
    });

    it('should call populateReadyQueue',
      function() {
        expect(service._masterPollQueue.populateReadyQueue.called).to.be.true;
    });
  });
});
