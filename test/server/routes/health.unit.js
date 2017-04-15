'use strict';

const HealthRouter = require('../../../lib/server/routes/health');
const expect = require('chai').expect;
const sinon = require('sinon');
const httpMocks = require('node-mocks-http');

describe('HealthRouter', function() {
  var healthRouter = new HealthRouter(
    require('../../_fixtures/router-opts')
  )

  describe('#health', function() {

      it('should return 200 if everything ok', function(done) {

        done();
      })
  })
})
