'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const ReportsRouter = require('../../../lib/server/routes/reports');

describe('ReportsRouter', function() {

  var reportsRouter = new ReportsRouter(
    require('../../_fixtures/router-opts')
  );

  describe('#createExchangeReport', function() {

    it('should return internal error if save fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeTime: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _reportSave = sinon.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, new Error('Failed to save report'));
      reportsRouter.createExchangeReport(request, response, function(err) {
        _reportSave.restore();
        expect(err.message).to.equal('Failed to save report');
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
          exchangeTime: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _reportSave = sinon.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      response.on('end', function() {
        _reportSave.restore();
        expect(response.statusCode).to.equal(201);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

  });

});
