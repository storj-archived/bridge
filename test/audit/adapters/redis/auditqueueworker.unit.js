'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Async = require('async');
const Config = require('../../../../lib/config')('devel').audits;

var stubRefs = {
  recallStub: sinon.stub(),
  renterStub: sinon.stub(),
  auditorStub: {
      get: sinon.stub(),
      process: sinon.stub(),
      getPendingQueue: sinon.stub()
  },
  queueStub: sinon.spy(Async, 'queue')
};

stubRefs.recallStub.callsArgWith(1, null, {
  map: sinon.stub()
});

stubRefs.auditorStub.getPendingQueue.callsArgWith(0, null, [1,2,3]);
stubRefs.auditorStub.get.onCall(0).callsArgWith(0, null, 1);
stubRefs.auditorStub.get.onCall(1).callsArgWith(0, null, 1);
stubRefs.auditorStub.get.onCall(2).callsArgWith(0, null, 1);
stubRefs.auditorStub.process.callsArgWith(1);

const AuditQueueWorker = proxyquire(
  '../../../../lib/audit/adapters/redis/auditqueueworker.js', {
    'storj': {
      Verification: function() {
        return {
          verify: sinon.stub()
        };
      },
      Manager: sinon.stub(),
      KeyPair: sinon.stub(),
      RenterInterface: stubRefs.renterStub
    },
    '../../../storage/adapter': sinon.stub(),
    '../../../storage': function() {
      return {
        models: {
          Contact: {
            recall: stubRefs.recallStub
          }
        }
      };
    },
    './auditor.js': function() {
      return stubRefs.auditorStub;
    },
    'async': stubRefs.queueStub
  }
);

stubRefs.createStub = sinon.spy(AuditQueueWorker.prototype,
  '_createConnection'
);

stubRefs.initStub = sinon.stub(
  AuditQueueWorker.prototype,
  '_initDispatchQueue',
  function(){}
);

stubRefs.flushStub = sinon.spy(AuditQueueWorker.prototype,
  '_flushStalePendingQueue'
);

var config = Object.assign(Config.workers[0], {redis: Config.redis});
var service = new AuditQueueWorker(config);

describe('audit/adapters/redis/auditqueueworker', function() {
  describe('@constructor', function() {
    it('should recall contacts from the storage adapter', function() {
      expect(stubRefs.recallStub.called).to.be.true;
    });

    it('should create a connection', function() {
      expect(stubRefs.createStub.called).to.be.true;
    });

    it('should instantiate an Auditor', function() {
      expect(service._auditor).to.be.an('object');
    });

    it('should call _flushStalePendingQueue on instantiation', function() {
      expect(stubRefs.flushStub.called).to.be.true;
    });
  });

  describe('_flushStalePendingQueue', function() {
    after(function() {
      stubRefs.queueStub.restore();
    });

    it('should call the queue with the config limit', function() {
      expect(stubRefs.queueStub.calledWith(sinon.match.any, config.limit))
        .to.be.true;
    });

    it('should retrieve the pending queue on start', function() {
      expect(service._auditor.getPendingQueue.called).to.be.true;
    });

    it('should call the auditor\'s process method', function() {
      expect(service._auditor.process.callCount).to.equal(3);
    });
  });

  describe('_initDispatchQueue', function() {
    before(function() {
      stubRefs.initStub.restore();
      stubRefs.initStub = sinon.spy(
        AuditQueueWorker.prototype,
        '_initDispatchQueue'
      );
      //stubRefs.dispatchStub.
      service = new AuditQueueWorker(config);
    });

    after(function() {
      stubRefs.queueStub.restore();
    });

    it('should call the queue with the config limit', function() {
      expect(stubRefs.queueStub.calledWith(sinon.match.any, config.limit))
        .to.be.true;
    });

    it('should get an audit via the auditor\'s get method', function() {
      expect(service._auditor.get.called).to.be.true;
    });

    it('should call the auditor\'s process method', function() {
      expect(service._auditor.process.called).to.be.true;
    });
  });
});
