'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const AuditQueueWorker = proxyquire(
  '../../lib/audit/auditqueueworker.js',
  {'Verification': {verify: function(){return true;}}});

describe('AuditQueueWorker', function() {
  before(function(done) {
    var workerConfig = Object.create(Config.worker[0], {redis: Config.redis});
    var pendingItems = [];

    for(let i = 0; i < 10; i++) {
      pendingItems.push({
        ts: Math.floor(new Date() / 1000),
        data: {
          id: i,
          root: '',
          depth: '',
          challenge: '',
          hash: ''
        }
      });
    }

    redisClient.LPUSH(
      service._queue._keys.pending,
      pendingItems,
      function(err, result) {
        expect(err).to.be.a('null');
        expect(result).to.equal(10);
        sinon.spy(AuditQueueWorker.prototype, '_flushStalePendingQueue');
        sinon.spy(AuditQueueWorker.prototype, '_initDispatchQueue');
        service = new AuditQueueWorker(workerConfig);
        done();
      });
  });

  after(function() {
    service = null;
  });

  describe('_flushStalePendingQueue', function() {
    before(function() {
      sinon.spy(service._queue, 'getPendingQueue');
      sinon.spy(service._dispatcher, '_verify');
      sinon.spy(service._dispatcher, '_commit');
    });

    it('should retrieve the pending queue on start', function(done) {
      expect(service._flushStalePendingQueue.called).to.be.true;
      expect(service._queue.getPendingQueue.called).to.be.true;
    });

    it('should call the dispatcher\'s verify method', function(done) {
      expect(service._dispatcher._verify.called).to.be.true;
    });

    it('should commit tasks to a final queue', function(done) {
      expect(service._dispatcher._commit.called).to.be.true;
    });

    it('should empty the pending queue', function(done) {

    });
  });

  describe('_initDispatchQueue', function() {
    it('should take an item from the ready queue'
      + 'and place it on the pending queue', function(done) {

      });

      it('should send audit requests', function(done) {

      });

      it('should verify audit results', function(done) {

      });

      it('should commit tasks to a final queue', function(done) {

      });
    });
});
