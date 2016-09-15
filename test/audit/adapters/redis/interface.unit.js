'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const RQueue = require('../../../../lib/audit/adapters/redis/queue.js');
const Config = require('../../../../lib/config')('devel').audits;
const AuditInterface = require('../../../../lib/audit/abstractauditinterface');

var stubRefs = {
  queue: sinon.spy(RQueue),
  subscribe: sinon.stub(),
  on: sinon.stub(),
  add: sinon.stub(RQueue.prototype, 'add'),
  createAuditJobs: sinon.stub(
    AuditInterface.prototype,
    'createAuditJobs'
  ),
  abs: sinon.spy(AuditInterface),
  pass: sinon.stub(
    AuditInterface.prototype,
    'passHandler'
  ),
  fail: sinon.stub(
    AuditInterface.prototype,
    'failHandler'
  ),
};

var Interface = proxyquire(
  '../../../../lib/audit/adapters/redis/interface.js', {
    'redis' : {
      createClient: function(){
        return {
          subscribe: stubRefs.subscribe,
          on: stubRefs.on
        }
      }
    },
    '../../abstractauditinterface': stubRefs.abs,
    './queue.js': stubRefs.queue
});

var service = new Interface(Object.assign({}, Config.adapter));

describe('audit/adapters/redis/interface', function() {
  describe('@constructor', function() {
    it('inherits from AbstractAuditInterface', function() {
      expect(service instanceof AuditInterface).to.be.true;
    });

    it('creates a subscriber redis client', function() {
      expect(service.subscriber).to.exist;
    });

    it('creates an adding redis client', function() {
      expect(service.adder).to.exist;
    });

    it('subscribes to the pass and fail channels', function() {
      expect(service.subscriber.subscribe.calledWith(RQueue.sharedKeys.pass));
      expect(service.subscriber.subscribe.calledWith(RQueue.sharedKeys.fail));
    });

    it('calls failHandler on failed messages', function() {
      stubRefs.on.callsArgWith(1, RQueue.sharedKeys.fail, 'fail')
      service = new Interface(Object.assign({}, Config.adapter));
      expect(stubRefs.fail.called).to.be.true;
    });

    it('calls passHandler on passed messages', function() {
      stubRefs.on.callsArgWith(1, RQueue.sharedKeys.pass, 'pass')
      service = new Interface(Object.assign({}, Config.adapter));
      expect(stubRefs.pass.called).to.be.true;
    });
  });

  describe('add', function() {
    it('calls add on the Redis Queue', function() {
      service.adder.ZADD = sinon.stub();
      service.add([1,2,3], function() {
      });
      expect(service.adder.ZADD.args[0][0].length).to.be.equal(7);
    });
  });

  describe('createAuditJobs', function() {
    var jobs = service.createAuditJobs({
      start: 123,
      end: 123,
      farmer: 123,
      hash: 123,
      root: 123,
      depth: 123,
      challenges: [123,123,123,123,123]
    });

    it('calls the super createAuditJobs', function() {
      expect(stubRefs.createAuditJobs.called).to.be.true;
    });

    it('creates a job per challenge', function() {
      expect(jobs.length).to.equal(5);
    })
  });
});
