'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const errors = require('storj-service-error-types');
const EventEmitter = require('events').EventEmitter;
const ReportsRouter = require('../../../lib/server/routes/reports');

describe('ReportsRouter', function() {

  var reportsRouter = new ReportsRouter(
    require('../../_fixtures/router-opts')
  );

  describe('#createExchangeReport', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(function() {
      sandbox.restore();
    });

    it('should return internal error if save fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, [{}]);

      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, new Error('Failed to save report'));
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        expect(err.message).to.equal('Failed to save report');
        done();
      });
    });

    it('should give error if datahash does not exist', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, []);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        var save = reportsRouter.storage.models.ExchangeReport.prototype.save;
        expect(save.callCount).to.equal(0);
        done();
      });
    });

    it('should give error if datahash does not exist', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, null);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        var save = reportsRouter.storage.models.ExchangeReport.prototype.save;
        expect(save.callCount).to.equal(0);
        done();
      });
    });

    it('should give error if datahash does not exist', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, new Error('Internal error'));
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        var save = reportsRouter.storage.models.ExchangeReport.prototype.save;
        expect(save.callCount).to.equal(0);
        done();
      });
    });

    it('should send 201 if report saved', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, [{}]);
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      response.on('end', function() {
        expect(response.statusCode).to.equal(201);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

  });

  describe('#_handleExchangeReport', function() {

    // TODO

  });

  describe('#_triggerMirrorEstablish', function() {

    // TODO

  });

});
