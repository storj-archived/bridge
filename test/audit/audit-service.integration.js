'use strict'
/*
const fork = require('process').fork;
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Config = require('../../lib/config')('devel').audits;
const AuditService = require('../../lib/audit');
const AuditQueueWorker = proxyquire(
  '../../lib/audit/auditqueueworker.js',
  {'Verification': {verify: function(){return true;}}});
const redis = require('redis');

describe('audit/integration', function() {
  var service, storj;

  var redisClient = redis.createClient({
    host: '127.0.0.1',
    port: 6379,
    user: null,
    pass: null
  });

  describe('Empty Queue', function() {
    //creates and inspects empty workers & master
    before(function() {
      var workerConfig = Object.assign(Config.worker[0], {redis: Config.redis});

    });

    it('should queue n number of redis pop requests', function() {

    });


  });

  describe('E2E', function() {
    //negotiates contracts, generating audits, inspects results
    it('should send all provided audits', function() {

    });

    it('should send audits in acceptable time window', function() {
      var acceptable = 1000;

    });

    it('should pass all provided audits', function() {

    });

  });

  describe('Component Failures', function() {
    //tests behavior in case of DB failures
    it('should restart workers on failure', function() {

    });

    it('should retry failed redis requests, before exiting', function() {

    });

  });

  describe('Farmer Failures', function() {
    //tests behavior in case of Farmer failures
    it('should fail all provided audits', function() {

    });

  });
});
*/
