'use strict';

const EventEmitter = require('events').EventEmitter;
const sinon = require('sinon');
const httpMocks = require('node-mocks-http');
const expect = require('chai').expect;
const limiter = require('../../lib/server/limiter');
const log = require('../../lib/logger');
const errors = require('storj-service-error-types');

let sandbox;

beforeEach(() => {
  sandbox = sinon.sandbox.create();
});

afterEach(() => sandbox.restore());

describe('Limiter', () => {
  it('should export defaults', () => {
    const defaults = limiter.DEFAULTS;
    expect(defaults).to.be.an('object');
  });

  it('should lookup based on forwarded header', () => {
    const defaults = limiter.DEFAULTS;
    const req = {
      headers: {
        'x-forwarded-for': '127.0.0.2'
      },
      connection: {
        remoteAddress: '127.0.0.3'
      }
    };
    expect(defaults.lookup(req)).to.eql(['127.0.0.2']);
  });

  it('should lookup based on remote address', () => {
    const defaults = limiter.DEFAULTS;
    const req = {
      headers: {},
      connection: {
        remoteAddress: '127.0.0.3'
      }
    };
    expect(defaults.lookup(req)).to.eql(['127.0.0.3']);
  });

  it('should return rate limited error', (done) => {
    const req = httpMocks.createRequest({
      connection: {
        remoteAddress: '127.0.0.1'
      }
    });
    const res = httpMocks.createResponse({
      req: req,
      eventEmitter: EventEmitter
    });
    const next = function() {
      return errors.RateLimited('Too Many Requests');
    };
    const _log = sandbox.spy(log, 'info');
    const limit = limiter.DEFAULTS.onRateLimited(req, res, next);

    expect(limit.statusCode).to.equal(429);
    expect(limit.message).to.equal('Too Many Requests');
    expect(limit).to.be.instanceOf(Error);
    expect(_log.callCount).to.equal(1);
    done();
  });

});
