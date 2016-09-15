'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const RQueue = require('../../../../lib/audit/adapters/redis/queue.js');
const Config = require('../../../../lib/config')('devel').audits;
const Contact = require('storj').Contact;

var stubRefs = {
  queue: sinon.spy(RQueue),
  verifyStub: sinon.stub(),
  popReadyQueue: sinon.stub(RQueue.prototype, 'popReadyQueue'),
  pushResultQueue: sinon.stub(RQueue.prototype, 'pushResultQueue'),
  awaitReadyQueue: sinon.stub(RQueue.prototype, 'awaitReadyQueue')
};

var Auditor = proxyquire(
  '../../../../lib/audit/adapters/redis/auditor.js', {
    'storj': {
      Verification: function() {
        return {
          verify: stubRefs.verifyStub
        };
      },
      Contact: function(farmer) {
        this.farmer = farmer;
      }
    },
    './queue.js': stubRefs.queue
});

var service;
var network;
var queue;
var storage;
var mongo;

describe('audit/adapters/redis/auditor', function() {
  before(function() {
    network = {
      getStorageProof: sinon.stub(),
      router: {
        getContactByNodeID: sinon.stub(),
        lookup: sinon.stub()
      }
    };

    storage = {
      models: {
        Contact: {
          findOne: sinon.stub()
        }
      }
    };

    mongo = {
      _get: sinon.stub()
    };

    service = new Auditor(network, storage, mongo, {}, 123);
  });

  describe('@constructor', function() {
    it('accepts an adapter config, storj network instance, uuid', function() {
      expect(service._queue).to.be.an('object');
      expect(service._network).to.be.an('object');
      expect(stubRefs.queue.calledWithNew()).to.be.true;
      expect(service._mongo).to.be.an('object');
    });
  });

  describe('get', function() {
    var auditResp;

    before(function() {
      service._queue.popReadyQueue.callsArgWith(0, null, {audit: true});
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

  describe('awaitGet', function() {
    var auditResp;

    before(function() {
      service._queue.awaitReadyQueue.callsArgWith(0, null, {audit: true});
      service.awaitGet(function(err, audit) {
        auditResp = audit;
      });
    });

    it('calls the queue\'s awaitReadyQueue method', function() {
      expect(service._queue.awaitReadyQueue.called).to.be.true;
    });

    it('returns an audit', function() {
      expect(auditResp.audit).to.be.true;
    });
  });

  describe('verify', function() {
    this.timeout(5000);
    var test_audit;
    var status;
    var verifyInput = {
      id: 123,
      hash: 'xyz',
      challenge: 9
    };
/*
    before(function(done) {
      //network.getStorageProof.callsArgWith(3, null, 'proof');
      //stubRefs.verifyStub.returns([1,1]);
    });
*/
    it('returns fail, if all contact strategies return null', function() {
      network.router.getContactByNodeID.returns(null);
      storage.models.Contact.findOne.callsArgWith(1, null, null);
      network.router.lookup.callsArgWith(2, null, null);

      service = new Auditor(network, storage, mongo, {}, 123);
      service.verify(verifyInput, function(err, audit, hasPassed) {
        test_audit = audit;
        status = hasPassed;
      });

      expect(status).to.be.false;
    });

    it('attempts to locate a network contact 3rd', function() {
      network.router.getContactByNodeID.returns(null);
      storage.models.Contact.findOne.callsArgWith(1, null, null);
      network.router.lookup.callsArgWith(2, null, 'network');
      mongo._get.callsArgWith(1, null, 'storageItem')
      network.getStorageProof.callsArgWith(2, null, 'proof')
      stubRefs.verifyStub.returns([1,1]);

      service = new Auditor(network, storage, mongo, {}, 123);

      service.verify(verifyInput, function(err, audit, hasPassed) {
        test_audit = audit;
        status = hasPassed;
      });

      expect(service._network.getStorageProof.calledWith({ farmer: 'network' })).to.be.true;
    });

    it('attempts to locate an in-storage contact 2nd', function() {
      network.router.getContactByNodeID.returns(null);
      storage.models.Contact.findOne.callsArgWith(1, null, 'storage');
      network.router.lookup.callsArgWith(2, null, null);
      mongo._get.callsArgWith(1, null, 'storageItem')
      network.getStorageProof.callsArgWith(2, null, 'proof')
      stubRefs.verifyStub.returns([1,1]);

      service = new Auditor(network, storage, mongo, {}, 123);

      service.verify(verifyInput, function(err, audit, hasPassed) {
        test_audit = audit;
        status = hasPassed;
      });

      expect(service._network.getStorageProof.calledWith({ farmer: 'storage' })).to.be.true;
    });

    it('attempts to locate an in-memory contact 1st', function() {
      network.router.getContactByNodeID.returns('mem');
      storage.models.Contact.findOne.callsArgWith(1, null, null);
      network.router.lookup.callsArgWith(2, null, null);
      mongo._get.callsArgWith(1, null, 'storageItem')
      network.getStorageProof.callsArgWith(2, null, 'proof')
      stubRefs.verifyStub.returns([1,1]);

      service = new Auditor(network, storage, mongo, {}, 123);

      service.verify(verifyInput, function(err, audit, hasPassed) {
        test_audit = audit;
        status = hasPassed;
      });

      expect(service._network.getStorageProof.calledWith({ farmer: 'mem' })).to.be.true;
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
