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
  createJobFromStorageItem: sinon.stub(
    AuditInterface.prototype,
    'createJobFromStorageItem'
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
    it('creates a queue property', function() {
      expect(service.redisQueue).to.exist;
    });

    it('creates a subscriber client', function() {
      expect(service.subscriber).to.exist;
    });

    it('subscribes to the pass and fail channels', function() {
      expect(service.subscriber.subscribe.calledWith(service.redisQueue.pass));
      expect(service.subscriber.subscribe.calledWith(service.redisQueue.fail));
    });

    it('calls failHandler on failed messages', function() {
      stubRefs.on.callsArgWith(1, service.redisQueue.rKeys.fail, 'pass')
      service = new Interface(Object.assign({}, Config.adapter));
      expect(stubRefs.fail.called).to.be.true;
    });

    it('calls passHandler on passed messages', function() {
      stubRefs.on.callsArgWith(1, service.redisQueue.rKeys.pass, 'pass')
      service = new Interface(Object.assign({}, Config.adapter));
      expect(stubRefs.pass.called).to.be.true;
    });
  });

  describe('add', function() {
    it('calls add on the Redis Queue', function() {
      service.add(null, null);
      expect(stubRefs.add.called).to.be.true;
    });
  });

  describe('createJobFromStorageItem', function() {
    it('calls the super createJobFromStorageItem', function() {
      service.createJobFromStorageItem('123', {
        contracts: {'123':{
          start_time: 1,
          end_time: 1
        }},
        challenges: {'123':{
            challenges: []
        }}
      });

      expect(stubRefs.createJobFromStorageItem.called).to.be.true;
    });
  });
});
