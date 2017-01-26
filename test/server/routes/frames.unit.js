'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const FramesRouter = require('../../../lib/server/routes/frames');
const errors = require('storj-service-error-types');
const log = require('../../../lib/logger');

describe('FramesRouter', function() {

  const sandbox = sinon.sandbox.create();

  afterEach(() => sandbox.restore());

  var framesRouter = new FramesRouter(
    require('../../_fixtures/router-opts')
  );
  var someUser = new framesRouter.storage.models.User({
    _id: 'gordon@storj.io',
    hashpass: storj.utils.sha256('password')
  });
  someUser.isUploadRateLimited = sinon.stub().returns(false);
  someUser.recordUploadBytes = sinon.stub().returns({
    save: sinon.stub().callsArg(0)
  });

  describe('#createFrame', function() {

    it('should give error if transfer rate limit reached', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/frames'
      });
      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(true);
      testUser.recordUploadBytes = sandbox.stub().returns({
        save: sandbox.stub().callsArg(0)
      });
      request.user = testUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        framesRouter.storage.models.Frame,
        'create'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.createFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.TransferRateError);
        expect(err.message).to.match(/Could not create frame, transfer/);
        expect(testUser.recordUploadBytes.callCount).to.equal(0);
        expect(testUser.isUploadRateLimited.callCount).to.equal(1);
        done();
      });
    });

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
    const sandbox = sinon.sandbox.create();

    var auditStream = new storj.AuditStream(3);

    before(function(done) {
      auditStream.on('finish', done).end('data');
    });

    afterEach(() => sandbox.restore());

    it('should give error if transfer rate limit reached', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });
      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.recordUploadBytes = sandbox.stub().returns({
        save: sandbox.stub().callsArg(0)
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(true);
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.addShardToFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.TransferRateError);
        expect(err.message).to.match(/Could not add shard to frame, transfer/);
        expect(testUser.recordUploadBytes.callCount).to.equal(0);
        expect(testUser.isUploadRateLimited.callCount).to.equal(1);
        done();
      });

    });

    it('should return internal error if frame query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return not found if frame not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        expect(err.message).to.equal('Frame not found');
        done();
      });
    });

    it('should return internal error if pointer cannot create', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        _pointerCreate.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return bad request if audit stream throws', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      var _auditFromRecords = sinon.stub(
        storj.AuditStream,
        'fromRecords'
      ).throws(new Error('Invalid audit stream'));
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        _pointerCreate.restore();
        _auditFromRecords.restore();
        expect(err.message).to.equal('Invalid audit stream');
        done();
      });
    });

    it('should return internal error if no offer received', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      var _getContract = sinon.stub(
        framesRouter,
        '_getContractForShard'
      ).callsArgWith(3, new Error('No storage offers received'));
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        _pointerCreate.restore();
        _getContract.restore();
        expect(err.message).to.equal('No storage offers received');
        done();
      });

    });

    it('should return internal error if no consign token', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      var _getContract = sinon.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );
      var _getConsign = sinon.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, new Error('Cannot get token'));
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        _pointerCreate.restore();
        _getContract.restore();
        _getConsign.restore();
        expect(err.message).to.equal('Cannot get token');
        done();
      });
    });

    it('should return internal error if frame cannot reload', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      _frameFindOne.onCall(1).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, new Error('Cannot reload frame'))
      });
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      var _getContract = sinon.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );
      var _getConsign = sinon.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, null, { token: 'token' });
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        _pointerCreate.restore();
        _getContract.restore();
        _getConsign.restore();
        expect(err.message).to.equal('Cannot reload frame');
        done();
      });
    });

    it('should return internal error if frame cannot update', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
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
      var _frameSave = sinon.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0, new Error('Cannot save frame'));
      _frameFindOne.onCall(1).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(
          0,
          null,
          new framesRouter.storage.models.Frame({
            user: someUser._id
          })
        )
      });
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      var _getContract = sinon.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );
      var _getConsign = sinon.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, null, { token: 'token' });
      framesRouter.addShardToFrame(request, response, function(err) {
        _frameFindOne.restore();
        _pointerCreate.restore();
        _getContract.restore();
        _getConsign.restore();
        _frameSave.restore();
        expect(err.message).to.equal('Cannot save frame');
        done();
      });
    });

    it('should return data channel pointer', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });
      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      const saveUploadBytes = sandbox.stub().callsArg(0);
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().returns({
        save: saveUploadBytes
      });
      request.user = testUser;
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
      var _frameSave = sinon.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);
      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.shards[0] = {
        index: 0
      };
      _frameFindOne.onCall(1).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(
          0,
          null,
          frame1
        )
      });
      var _pointerCreate = sinon.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      var _getContract = sinon.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );
      var _getConsign = sinon.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, null, { token: 'token' });
      response.on('end', function() {
        _frameFindOne.restore();
        _pointerCreate.restore();
        _getContract.restore();
        _getConsign.restore();
        _frameSave.restore();
        var result = response._getData();
        expect(result.farmer.nodeID).to.equal(storj.utils.rmd160('farmer'));
        expect(result.hash).to.equal(storj.utils.rmd160('data'));
        expect(result.token).to.equal('token');
        expect(result.operation).to.equal('PUSH');
        expect(saveUploadBytes.callCount).to.equal(1);
        expect(testUser.recordUploadBytes.callCount).to.equal(1);
        done();
      });
      framesRouter.addShardToFrame(request, response);
    });

    it('will log error if failure to save upload bytes', function(done) {
      sandbox.stub(log, 'warn');
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });
      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      const saveUploadBytes = sandbox.stub().callsArgWith(0, new Error('test'));
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().returns({
        save: saveUploadBytes
      });
      request.user = testUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, new framesRouter.storage.models.Frame({
        user: someUser._id
      }));
      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);
      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.shards[0] = {
        index: 0
      };
      _frameFindOne.onCall(1).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(
          0,
          null,
          frame1
        )
      });
      sandbox.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));
      sandbox.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );
      sandbox.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, null, { token: 'token' });
      response.on('end', function() {
        expect(saveUploadBytes.callCount).to.equal(1);
        expect(testUser.recordUploadBytes.callCount).to.equal(1);
        expect(log.warn.callCount).to.equal(1);
        done();
      });
      framesRouter.addShardToFrame(request, response);
    });

    it('should not double increment shard', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: storj.utils.rmd160('data'),
          size: 1024 * 1024 * 8,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });
      request.user = someUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      var frame = new framesRouter.storage.models.Frame({
        user: someUser._id,
      });

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.shards[0] = {
        index: 0
      };
      frame1.size = 1024 * 1024 * 8;
      _frameFindOne.onCall(1).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(
          0,
          null,
          frame1
        )
      });

      sandbox.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, null, new framesRouter.storage.models.Pointer({
        index: 0,
        hash: storj.utils.rmd160('data'),
        size: 1024 * 1024 * 8,
        challenges: auditStream.getPrivateRecord().challenges,
        tree: auditStream.getPublicRecord()
      }));

      sandbox.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );

      sandbox.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, null, { token: 'token' });

      response.on('end', function() {
        expect(frame1.size).to.equal(1024 * 1024 * 8);
        done();
      });

      framesRouter.addShardToFrame(request, response);
    });

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
