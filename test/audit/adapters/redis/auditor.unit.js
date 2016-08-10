'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const RQueue = require('../../../../lib/audit/adapters/redis/queue.js');
const Config = require('../../../../lib/config')('devel').audits;

var stubRefs = {
  queue: sinon.spy(RQueue),
  verifyStub: sinon.stub(),
  popReadyQueue: sinon.stub(RQueue.prototype, 'popReadyQueue'),
  pushResultQueue: sinon.stub(RQueue.prototype, 'pushResultQueue')
};

var Auditor = proxyquire(
  '../../../../lib/audit/adapters/redis/auditor.js', {
    'storj': {
      Verification: function() {
        return {
          verify: stubRefs.verifyStub
        };
      }
    },
    './queue.js': stubRefs.queue
});

var service;
var network;
var queue;

describe('audit/adapters/redis/auditor', function() {
  before(function() {
    network = {
      getStorageProof: sinon.stub()
    };

    service = new Auditor(network, {}, 123);
  });

  describe('@constructor', function() {
    it('accepts an adapter config, storj network instance, uuid', function() {
      expect(service._queue).to.be.an('object');
      expect(service._network).to.be.an('object');
      expect(
        stubRefs.queue.calledWithNew()).to.be.true;
    });
  });

  describe('get', function() {
    var auditResp;

    before(function() {
      service._queue.popReadyQueue.callsArgWith(0, null, '{"audit": true}');
      service.get(function(err, audit) {
        auditResp = audit;
      });
    });

    it('calls the queue\'s popReadyQueue method', function() {
      expect(service._queue.popReadyQueue.called).to.be.true;
    });

    it('returns an audit', function() {
      expect(auditResp.audit).to.be.true;
    });
  });

  describe('verify', function() {
    var test_audit;
    var status;

    before(function() {
      network.getStorageProof.callsArgWith(3, null, 'proof');
      stubRefs.verifyStub.returns([1,1]);
      service.verify({
        id: 123,
        hash: 'xyz',
        challenge: 9
      }, function(err, audit, hasPassed) {
        test_audit = audit;
        status = hasPassed;
      });
    });

    it('calls the network\'s getStorageProof method', function() {
      expect(service._network.getStorageProof.called).to.be.true;
    });

    it('calls storj core\'s verify method', function() {
      expect(stubRefs.verifyStub.called).to.true;
    });

    it('returns the audit and its verification status', function() {
      expect(test_audit.id).to.equal(123);
      expect(status).to.be.true;
    });
  });

  describe('commit', function() {
    var test_succcess;

    before(function() {
      service._queue.pushResultQueue.callsArgWith(2, null, true);
      service.commit(1, 1, function(err, isSuccess) {
        test_succcess = isSuccess;
      });
    });

    it('calls the queue\'s pushResultQueue method', function() {
      expect(service._queue.pushResultQueue.called).to.be.true;
    });

    it('returns the push status', function() {
      expect(test_succcess).to.be.true;
    });
  });
});
