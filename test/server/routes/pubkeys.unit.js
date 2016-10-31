'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const PubkeysRouter = require('../../../lib/server/routes/pubkeys');

describe('PubkeysRouter', function() {

  var pubkeysRouter = new PubkeysRouter(
    require('../../_fixtures/router-opts')
  );
  var someUser = new pubkeysRouter.storage.models.User({
    _id: 'gordon@storj.io',
    hashpass: storj.utils.sha256('password')
  });

  describe('#getPublicKeys', function() {

    it('should return internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/keys'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyFind = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'find'
      ).callsArgWith(1, new Error('Panic!'));
      pubkeysRouter.getPublicKeys(request, response, function(err) {
        _pubkeyFind.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return list of pubkeys', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/keys'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyFind = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'find'
      ).callsArgWith(1, null, [
        new pubkeysRouter.storage.models.PublicKey({ _id: 'key1' }),
        new pubkeysRouter.storage.models.PublicKey({ _id: 'key2' })
      ]);
      response.on('end', function() {
        var result = response._getData();
        _pubkeyFind.restore();
        expect(result).to.have.lengthOf(2);
        done();
      });
      pubkeysRouter.getPublicKeys(request, response);
    });

  });

  describe('#addPublicKey', function() {

    it('should return internal error if mongodb fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/keys',
        body: {
          key: 'key1'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var internalError = new Error('Panic!');
      internalError.code = 11000;
      var _pubkeyCreate = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'create'
      ).callsArgWith(3, internalError);
      pubkeysRouter.addPublicKey(request, response, function(err) {
        _pubkeyCreate.restore();
        expect(err.code).to.equal(500);
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return bad request if validation fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/keys',
        body: {
          key: 'key1'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyCreate = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'create'
      ).callsArgWith(3, new Error('Validation failed!'));
      pubkeysRouter.addPublicKey(request, response, function(err) {
        _pubkeyCreate.restore();
        expect(err.code).to.equal(400);
        expect(err.message).to.equal('Validation failed!');
        done();
      });
    });

    it('should return the created public key', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/keys',
        body: {
          key: 'key1'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyCreate = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'create'
      ).callsArgWith(3, null, new pubkeysRouter.storage.models.PublicKey({
        _id: 'key1'
      }));
      response.on('end', function() {
        _pubkeyCreate.restore();
        expect(response._getData().key).to.equal('key1');
        done();
      });
      pubkeysRouter.addPublicKey(request, response);
    });

  });

  describe('#destroyPublicKey', function() {

    it('should return internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/keys/key1'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyFindOne = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      pubkeysRouter.destroyPublicKey(request, response, function(err) {
        _pubkeyFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return not found if no public key', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/keys/key1'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyFindOne = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'findOne'
      ).callsArgWith(1, null, null);
      pubkeysRouter.destroyPublicKey(request, response, function(err) {
        _pubkeyFindOne.restore();
        expect(err.message).to.equal('Public key was not found');
        done();
      });
    });

    it('should return internal error if remove fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/keys/key1'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyRemove = sinon.stub(
        pubkeysRouter.storage.models.PublicKey.prototype,
        'remove'
      ).callsArgWith(0, new Error('Panic!'));
      var _pubkeyFindOne = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'findOne'
      ).callsArgWith(1, null, new pubkeysRouter.storage.models.PublicKey({
        _id: 'key1'
      }));
      pubkeysRouter.destroyPublicKey(request, response, function(err) {
        _pubkeyFindOne.restore();
        _pubkeyRemove.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return a 200 if delete succeeds', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/keys/key1'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _pubkeyRemove = sinon.stub(
        pubkeysRouter.storage.models.PublicKey.prototype,
        'remove'
      ).callsArgWith(0, null);
      var _pubkeyFindOne = sinon.stub(
        pubkeysRouter.storage.models.PublicKey,
        'findOne'
      ).callsArgWith(1, null, new pubkeysRouter.storage.models.PublicKey({
        _id: 'key1'
      }));
      response.on('end', function() {
        _pubkeyFindOne.restore();
        _pubkeyRemove.restore();
        expect(response.statusCode).to.equal(204);
        done();
      });
      pubkeysRouter.destroyPublicKey(request, response);
    });

  });

});

