'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const bridgeAnalytics = require('../../lib/vendor/analytics');
const Analytics = require('analytics-node');

describe('BridgeAnalytics', function() {

  describe('#track', function () {

    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(Analytics.prototype, 'track'));
    afterEach(() => sandbox.restore());

    it('should respect dnt headers', function(done) {
      expect(bridgeAnalytics.track('1', {})).to.equal(false);
      done();
    });

    it('should call super', function (done) {
      bridgeAnalytics.track(0, {});
      sinon.assert.calledOnce(Analytics.prototype.track);
      done();
    });
  });

  describe('#identify', function () {

    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(Analytics.prototype, 'identify'));
    afterEach(() => sandbox.restore());

    it('should respect dnt headers', function (done) {
      expect(bridgeAnalytics.identify('1', {})).to.equal(false);
      done();
    });

    it('should call super', function (done) {
      bridgeAnalytics.identify(0, {});
      sinon.assert.calledOnce(Analytics.prototype.identify);
      done();
    });
  });
});
