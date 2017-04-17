'use strict';

const HealthRouter = require('../../../lib/server/routes/health');
const expect = require('chai').expect;
const httpMocks = require('node-mocks-http');
const EventEmitter = require('events').EventEmitter;

describe('HealthRouter', function() {
  const healthRouter = new HealthRouter(
    require('../../_fixtures/router-opts')
  );

  describe('#health', function() {

      it('should return 200 if everything ok', function(done) {
        const req = httpMocks.createRequest({
          method: 'GET',
          url: '/health'
        });
        const res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        healthRouter.storage.connection.readyState = 1;

        res.on('end', function() {
          expect(res._getData()).to.equal('OK');
          done();
        });

        healthRouter.health(req, res);
      });

      it('should return 503 if health check fails', function(done) {
        const req = httpMocks.createRequest({
          method: 'GET',
          url: '/health'
        });
        const res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        healthRouter.storage.connection.readyState = 0;

        res.on('end', function() {
          console.log('res._getData()', res._getData());
          done();
        });

        healthRouter.health(req, res);
      });
  });
});
