'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Config = require('../../lib/config')('devel').audits;

var verifyStub = sinon.stub();
var Dispatcher = proxyquire(
  '../../lib/audit/dispatcher.js', {
    'storj': {
      Verification: function() {
        return {
          verify: verifyStub
        };
      }
    }
});

var service;
var network;
var queue;

describe('audit/dispatcher.js', function() {
  before(function() {
    queue = {
      popReadyQueue: sinon.stub(),
      pushResultQueue: sinon.stub()
    };

    network = {
      getStorageProof: sinon.stub()
    };

    service = new Dispatcher(queue, network);
  });

  describe('@constructor', function() {
    it('accepts queue and network', function() {
      expect(service._queue).to.be.an('object');
      expect(service._network).to.be.an('object');
    });
  });

  describe('get', function() {
    var auditResp;

    before(function() {
      queue.popReadyQueue.callsArgWith(0, null, '{"audit": true}');
      service._get(function(err, audit) {
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
      verifyStub.returns([1,1]);
      service._verify({
        id: 123,
        hash: 'xyz',
        challenge: 9
      }, function(err, audit, hasPassed) {
        console.log('here')
        test_audit = audit;
        status = hasPassed;
      });
    });

    it('calls the network\'s getStorageProof method', function() {
      expect(service._network.getStorageProof.called).to.be.true;
    });

    it('calls storj core\'s verify method', function() {
      expect(verifyStub.called).to.true;
    });

    it('returns the audit and its verification status', function() {
      expect(test_audit.id).to.equal(123);
    });
  });

  describe('commit', function() {
    var test_succcess;

    before(function() {
      queue.pushResultQueue.callsArgWith(2, null, true);
      service._commit(1, 1, function(err, isSuccess) {
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
