'use strict';

const http = require('http');
const sinon = require('sinon');
const storj = require('storj-lib');
const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const Config = require('../../..').Config;

describe('BucketsRouter Integration', function() {
  const sandbox = sinon.sandbox.create();
  afterEach(() => sandbox.restore());

  it('will give 400 error with bad object id', function(done) {
    sandbox.stub(console, 'info');
    sandbox.stub(console, 'error');

    function MockStorage() {
      this.models = {
        Bucket: {}
      };
    }
    function MockMailer() {}
    const MockComplex = {};
    function MockMongoAdapter() {}

    const TestEngine = proxyquire('../../../lib/engine', {
      'storj-service-storage-models': MockStorage,
      'storj-service-mailer': MockMailer,
      'storj-complex': MockComplex,
      'storj-mongodb-adapter': MockMongoAdapter
    });

    var config = Config('__tmptest');
    var engine = new TestEngine(config);
    engine._config.server = {
      port: 8081
    };

    sandbox.stub(storj, 'StorageManager').returns({});

    engine.start(function(err) {
      if (err) {
        return done(err);
      }

      const req = http.get({
        protocol: 'http:',
        hostname: 'localhost',
        port: 8081,
        path: '/buckets/notanobjectid'
      });

      let body = '';


      req.on('response', (res) => {
        expect(res.statusCode).to.equal(400);
        res
          .on('data', (data) => {
            body += data.toString();
          })
          .on('error', done)
          .on('end', () => {
            expect(body).to.match(/Bucket id is malformed/);
            done();
          });
      });
    });
  });
});
