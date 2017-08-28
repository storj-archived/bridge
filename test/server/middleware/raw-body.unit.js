'use strict';

const util = require('util');
const ReadableStream = require('stream').Readable;
const expect = require('chai').expect;
const sinon = require('sinon');

const rawbody = require('../../../lib/server/middleware/raw-body');

describe('Raw Body Middleware', function() {
  it('will not try to parse multipart', function(done) {
    var req = {
      get: sinon.stub().returns('multipart/form-data'),
      pipe: sinon.stub()
    };
    var res = {};
    rawbody(req, res, function() {
      expect(req.pipe.callCount).to.equal(0);
      expect(req.body).to.equal(undefined);
      expect(req.rawbody).to.equal(undefined);
      done();
    });
  });
  it('will set rawbody and body', function(done) {
    var res = {};
    function Stream(options) {
      ReadableStream.call(this, options);
    }
    util.inherits(Stream, ReadableStream);
    var data = '{"hello": "world"}';
    Stream.prototype._read = function() {
      this.push(data);
      data = null;
    };
    var req = new Stream();
    req.get = sinon.stub();
    rawbody(req, res, function() {
      expect(req.rawbody.toString()).to.equal('{"hello": "world"}');
      expect(req.body).to.deep.equal({hello: 'world'});
      done();
    });
  });
  it('will set rawbody and body with JSON parse error', function(done) {
    var res = {};
    function Stream(options) {
      ReadableStream.call(this, options);
    }
    util.inherits(Stream, ReadableStream);
    var data = '{"hello":';
    Stream.prototype._read = function() {
      this.push(data);
      data = null;
    };
    var req = new Stream();
    req.get = sinon.stub();
    rawbody(req, res, function() {
      expect(req.rawbody.toString()).to.equal('{"hello":');
      expect(req.body).to.deep.equal({});
      done();
    });
  });
});
