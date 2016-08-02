'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Async = require('async');
const Config = require('../../lib/config')('devel').audits;

var stubRefs = {
  recallStub: sinon.stub(),
  renterStub: sinon.stub(),
  dispatchStub: {
      get: sinon.stub(),
      verify: sinon.stub(),
      commit: sinon.stub()
  },
  queueStub: sinon.spy(Async, 'queue'),
  pendingStub: sinon.stub()
};

stubRefs.recallStub.callsArgWith(1, null, {
  map: sinon.stub()
});

stubRefs.pendingStub.callsArgWith(0, null, [1,2,3]);
stubRefs.dispatchStub.verify.callsArgWith(1, null, 1, true);
stubRefs.dispatchStub.commit.callsArgWith(2, null, 'pass');
stubRefs.dispatchStub.get.callsArgWith(0, null, 1);

const AuditQueueWorker = proxyquire(
  '../../lib/audit/auditqueueworker.js', {
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
    '../storage/adapter': sinon.stub(),
    '../storage': function() {
      return {
        models: {
          Contact: {
            recall: stubRefs.recallStub
          }
        }
      };
    },
    './queue.js': function() {
      return {
        getPendingQueue: stubRefs.pendingStub
      };
    },
    './auditor.js': function() {
      return stubRefs.dispatchStub;
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

describe('audit/auditqueueworker', function() {
  describe('@constructor', function() {
    it('should recall contacts from the storage adapter', function() {
      expect(stubRefs.recallStub.called).to.be.true;
    });

    it('should create a connection', function() {
      expect(stubRefs.createStub.called).to.be.true;
    });

    it('should instantiate an audit dispatcher', function() {
      expect(service._dispatcher).to.be.an('object');
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
      expect(service._queue.getPendingQueue.called).to.be.true;
    });

    it('should call the dispatcher\'s verify method', function() {
      expect(service._dispatcher.verify.callCount).to.equal(3);
    });

    it('should commit tasks to a final queue', function() {
      expect(service._dispatcher.commit.callCount).to.equal(3);
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

    it('should get an audit via the dispatcher\'s get method', function() {
      expect(stubRefs.dispatchStub.get.called).to.be.true;
    });

    it('should call the dispatcher\'s verify method', function() {
      expect(stubRefs.dispatchStub.verify.called).to.be.true;
    });

    it('should call the dispatcher\'s commit method', function() {
      expect(stubRefs.dispatchStub.commit.called).to.be.true;
    });
  });
});
