'use strict'

const fork = require('process').fork;
const expect = require('chai').expect;
const Config = require('../../lib/config')('devel').audits;
const AuditService = require('../../lib/audit');
const sinon = require('sinon');

describe('Audit-Service/Integration', function() {
  var service;
  before(function() {

    service = new AuditService(Config);
    service._options.pollQueue = true;
    sinon.spy(service._masterPollQueue, 'populateReadyQueue');
  });

  describe('Master Process', function() {
    it('should fork a process for each optional worker', function() {
      service._options.workers.forEach(function(workerConfig, ind) {
        expect(service._workers[workerConfig.uuid]).to.exist;
      });
    });

    it('should poll the backlog on start', function() {
      console.log(service._masterPollQueue.populateReadyQueue);
      console.log(service._masterPollQueue.populateReadyQueue.called);
      expect(service._masterPollQueue.populateReadyQueue.called).to.be.true;
    });

    it('should poll at a configured interval', function(done) {
      sinon.spy(service._masterPollQueue, 'populateReadyQueue')
      expect(service._masterPollQueue.populateReadyQueue.called).to.be.true;
      service._masterPollQueue.restore();
    });


    it('should restart workers on failure', function(done) {

    });
/*
    it(function() {

    });
*/
  });

  describe('_flushStalePendingQueue', function() {
    it('should retrieve the pending queue', function(done) {

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
