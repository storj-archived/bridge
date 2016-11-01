'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const FramesRouter = require('../../../lib/server/routes/frames');

describe('FramesRouter', function() {

  var framesRouter = new FramesRouter(
    require('../../_fixtures/router-opts')
  );
  var someUser = new framesRouter.storage.models.User({
    _id: 'gordon@storj.io',
    hashpass: storj.utils.sha256('password')
  });

  describe('#createFrame', function() {

    it('should return internal error if create fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/frames'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameCreate = sinon.stub(
        framesRouter.storage.models.Frame,
        'create'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.createFrame(request, response, function(err) {
        _frameCreate.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return the created frame', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/frames'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      var _frameCreate = sinon.stub(
        framesRouter.storage.models.Frame,
        'create'
      ).callsArgWith(1, null, frame1);
      response.on('end', function() {
        _frameCreate.restore();
        expect(response._getData().user).to.equal(someUser._id);
        done();
      });
      framesRouter.createFrame(request, response);
    });

  });

  describe('#_getContractForShard', function() {

    it('should callback with error if no offer received', function(done) {
      var _getStorageOffer = sinon.stub(
        framesRouter.network,
        'getStorageOffer'
      ).callsArgWith(2, new Error('No storage offers received'));
      var _contractsLoad = sinon.stub(
        framesRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Contract not found'));
      var contract = new storj.Contract({
        data_hash: storj.utils.rmd160('data')
      });
      var audits = new storj.AuditStream(3);
      framesRouter._getContractForShard(contract, audits, [], function(err) {
        _contractsLoad.restore();
        _getStorageOffer.restore();
        expect(err.message).to.equal('No storage offers received');
        done();
      });
    });

    it('should callback with error if contract cannot save', function(done) {
      var contract = new storj.Contract({
        data_hash: storj.utils.rmd160('data')
      });
      var audits = new storj.AuditStream(3);
      audits.getPublicRecord = sinon.stub().returns([]);
      audits.getPrivateRecord = sinon.stub().returns({});
      var _contractsLoad = sinon.stub(
        framesRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Contract not found'));
      var _getStorageOffer = sinon.stub(
        framesRouter.network,
        'getStorageOffer'
      ).callsArgWith(2, null, storj.Contact({
        address: '127.0.0.1',
        port: 1337,
        nodeID: storj.utils.rmd160('farmer')
      }), contract);
      var _contractsSave = sinon.stub(
        framesRouter.contracts,
        'save'
      ).callsArgWith(1, new Error('Failed to save'));
      framesRouter._getContractForShard(
        contract,
        audits,
        [],
        function(err) {
          _contractsLoad.restore();
          _getStorageOffer.restore();
          _contractsSave.restore();
          expect(err.message).to.equal('Failed to save');
          done();
        }
      );
    });

    it('should callback with farmer and contract', function(done) {
      var contract = new storj.Contract({
        data_hash: storj.utils.rmd160('data')
      });
      var audits = new storj.AuditStream(3);
      audits.getPublicRecord = sinon.stub().returns([]);
      audits.getPrivateRecord = sinon.stub().returns({});
      var _contractsLoad = sinon.stub(
        framesRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Contract not found'));
      var _getStorageOffer = sinon.stub(
        framesRouter.network,
        'getStorageOffer'
      ).callsArgWith(2, null, storj.Contact({
        address: '127.0.0.1',
        port: 1337,
        nodeID: storj.utils.rmd160('farmer')
      }), contract);
      var _contractsSave = sinon.stub(
        framesRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      framesRouter._getContractForShard(
        contract,
        audits,
        [],
        function(err, farmer, contract2) {
          _contractsLoad.restore();
          _getStorageOffer.restore();
          _contractsSave.restore();
          expect(farmer.nodeID).to.equal(storj.utils.rmd160('farmer'));
          expect(contract2.get('data_hash')).to.equal(
            contract.get('data_hash')
          );
          done();
        }
      );
    });

  });

  describe('#addShardToFrame', function() {

    it.skip('should return internal error if frame query fails');

    it.skip('should return not found if frame no found');

    it.skip('should return internal error if pointer cannot create');

    it.skip('should return bad request if audit stream throws');

    it.skip('should return internal error if no offer received');

    it.skip('should return internal error if cannot get consign token');

    it.skip('should return internal error if frame cannon reload');

    it.skip('should return internal error if frame cannot update');

    it.skip('should return data channel pointer');

  });

  describe('#destroyFrameById', function() {

    it('should return internal error if entry query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryFindOne = sinon.stub(
        framesRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.destroyFrameById(request, response, function(err) {
        _bucketEntryFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return bad request if frame is ref\'d by entry', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryFindOne = sinon.stub(
        framesRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(1, null, new framesRouter.storage.models.BucketEntry({
        user: someUser._id
      }));
      framesRouter.destroyFrameById(request, response, function(err) {
        _bucketEntryFindOne.restore();
        expect(err.message).to.equal(
          'Refusing to destroy frame that is referenced by a bucket entry'
        );
        done();
      });
    });

    it('should return internal error if frame query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryFindOne = sinon.stub(
        framesRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(1, null, null);
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.destroyFrameById(request, response, function(err) {
        _frameFindOne.restore();
        _bucketEntryFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return not found if no frame found', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryFindOne = sinon.stub(
        framesRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(1, null, null);
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, null);
      framesRouter.destroyFrameById(request, response, function(err) {
        _frameFindOne.restore();
        _bucketEntryFindOne.restore();
        expect(err.message).to.equal('Frame not found');
        done();
      });
    });

    it('should return internal error if remove fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameRemove = sinon.stub(
        framesRouter.storage.models.Frame.prototype,
        'remove'
      ).callsArgWith(0, new Error('Panic!'));
      var _bucketEntryFindOne = sinon.stub(
        framesRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(1, null, null);
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, new framesRouter.storage.models.Frame({
        user: someUser._id
      }));
      framesRouter.destroyFrameById(request, response, function(err) {
        _frameFindOne.restore();
        _bucketEntryFindOne.restore();
        _frameRemove.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return a 204 if delete succeeds', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameRemove = sinon.stub(
        framesRouter.storage.models.Frame.prototype,
        'remove'
      ).callsArgWith(0, null);
      var _bucketEntryFindOne = sinon.stub(
        framesRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(1, null, null);
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, new framesRouter.storage.models.Frame({
        user: someUser._id
      }));
      response.on('end', function() {
        _frameFindOne.restore();
        _bucketEntryFindOne.restore();
        _frameRemove.restore();
        expect(response.statusCode).to.equal(204);
        done();
      });
      framesRouter.destroyFrameById(request, response);
    });

  });

  describe('#getFrames', function() {

    it('should return internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/frames'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameFind = sinon.stub(
        framesRouter.storage.models.Frame,
        'find'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.getFrames(request, response, function(err) {
        _frameFind.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return frame list', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/frames'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      var frame2 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      var _frameFind = sinon.stub(
        framesRouter.storage.models.Frame,
        'find'
      ).callsArgWith(1, null, [frame1, frame2]);
      response.on('end', function() {
        _frameFind.restore();
        expect(response._getData()).to.have.lengthOf(2);
        done();
      });
      framesRouter.getFrames(request, response);
    });

  });

  describe('#getFrameById', function() {

    it('should return internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.getFrameById(request, response, function(err) {
        _frameFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return not found if no frame found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, null);
      framesRouter.getFrameById(request, response, function(err) {
        _frameFindOne.restore();
        expect(err.message).to.equal('Frame not found');
        done();
      });
    });

    it('should return the frame', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameFindOne = sinon.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, new framesRouter.storage.models.Frame({
        user: someUser._id
      }));
      response.on('end', function() {
        _frameFindOne.restore();
        expect(response._getData().user).to.equal(someUser._id);
        done();
      });
      framesRouter.getFrameById(request, response);
    });

  });

});
