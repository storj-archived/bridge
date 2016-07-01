'use strict'

const fork = require('process').fork;
const expect = require('chai').expect;
const Config = require('../../lib/config')('devel').audits;
const AuditService = require('../../lib/audit');
const AuditQueueWorker = require('../../lib/audit/auditqueueworker.js');
const sinon = require('sinon');

describe('Audit-Service/Integration', function() {
  var service, storj;

  describe('Master Process', function() {
    before(function() {
      sinon.spy(AuditService.prototype, 'pollBacklog');
      Config.polling.interval = 500;
      service = new AuditService(Config);
    });

    after(function() {
      service = null;
    });

    it('should fork a process for each optional worker', function() {
      service._options.workers.forEach(function(workerConfig, ind) {
        expect(service._workers[workerConfig.uuid]).to.exist;
      });
    });

    it('should poll the backlog on start', function() {
      expect(service.pollBacklog.called).to.be.true;
    });

    it('should repoll at a configured interval', function(done) {
      this.timeout(1000);
      expect(Config.polling.interval === 500).to.be.true;
      setTimeout(testPolled, Config.polling.interval + 100);

      function testPolled() {
        expect(service.pollBacklog.calledTwice).to.be.true;
        done();
      }
    });

    it('should restart workers on failure', function(done) {
      this.timeout(550);
      var uuid = Config.workers[0].uuid;
      service._workers[uuid].kill();
      expect(service._workers[uuid].killed).to.be.true;
      setTimeout(testRestart, 500);

      function testRestart() {
        expect(service._workers[uuid].killed).to.be.false;
        done();
      }
    });
/*
    it(function() {

    });
*/
  });
  describe('Worker Process', function() {
    before(function(done) {
      var workerConfig = Object.create(Config.worker[0], {redis: Config.redis});
      sinon.spy(AuditQueueWorker.prototype, '_flushStalePendingQueue');
      sinon.spy(AuditQueueWorker.prototype, '_initDispatchQueue');
      service = new AuditQueueWorker(workerConfig);
      service._queue.add({
        ts: Math.floor(new Date() / 1000),
        data: {
          challenge: ,
          hash: ,
          id:
        }
      });
    });

    after(function() {
      service = null;
    });

    describe('_flushStalePendingQueue', function() {
      it('should retrieve the pending queue', function(done) {
        expect.
      });

      it('should send audit requests', function(done) {

      });

      it('should verify audit results', function(done) {

      });

      it('should commit tasks to a final queue', function(done) {

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
});
