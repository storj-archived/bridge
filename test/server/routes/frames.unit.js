'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const FramesRouter = require('../../../lib/server/routes/frames');
const errors = require('storj-service-error-types');
const log = require('../../../lib/logger');
const analytics = require('storj-analytics');

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
  someUser.recordUploadBytes = sinon.stub().callsArg(1);

  describe('#createFrame', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

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
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
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

  describe('@_sortByResponseTime', function() {
    it('will sort correctly with best response time at index 0', function() {
      var available = [
        { contact: { responseTime: 10100 }},
        { contact: {} },
        { contact: { responseTime: 100 }},
        { contact: {} },
        { contact: { responseTime: 200 }},
        { contact: { responseTime: 4100 }},
        { contact: { responseTime: 2100 }}
      ];
      available.sort(FramesRouter._sortByResponseTime);
      expect(available).to.eql([
        { contact: { responseTime: 100 }},
        { contact: { responseTime: 200 }},
        { contact: { responseTime: 2100 }},
        { contact: { responseTime: 4100 }},
        { contact: { responseTime: 10100}},
        { contact: {}},
        { contact: {}}
      ]);
    });
  });

  describe('#_getContractForShard', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

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
      var res = { socket: { destroyed: false } };
      framesRouter._getContractForShard(contract, audits, [], res, function(err) {
        _contractsLoad.restore();
        _getStorageOffer.restore();
        expect(err.message).to.equal('No storage offers received');
        done();
      });
    });

    it('should cancel and not save contract with client timeout', function() {
      sandbox.stub(
        framesRouter.network,
        'getStorageOffer'
      ).callsArgWith(2, null, {}, {});

      var hash = storj.utils.rmd160('data');
      var contract = new storj.Contract({
        data_hash: hash
      });
      var item = new storj.StorageItem({ hash: hash });
      sandbox.stub(item, 'addContract');
      sandbox.stub(
        framesRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);

      var audits = new storj.AuditStream(3);
      var res = { socket: { destroyed: true } };
      framesRouter._getContractForShard(contract, audits, [], res);
      expect(item.addContract.callCount).to.equal(0);
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
      var res = { socket: { destroyed: false } };
      framesRouter._getContractForShard(
        contract,
        audits,
        [],
        res,
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
      var res = { socket: { destroyed: false } };
      framesRouter._getContractForShard(
        contract,
        audits,
        [],
        res,
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
    /* jshint maxstatements: 100 */
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

    var auditStream = new storj.AuditStream(3);

    before(function(done) {
      auditStream.on('finish', done).end('data');
    });

    it('should give error with max blacklisted nodeids', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          exclude: new Array(400),
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

      framesRouter.addShardToFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });

    });

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
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
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
      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      framesRouter.addShardToFrame(request, response, function(err) {
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
      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, null);
      framesRouter.addShardToFrame(request, response, function(err) {
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

      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });

      frame.addShard = sandbox.stub().callsArg(1);

      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Pointer,
        'create'
      ).callsArgWith(1, new Error('Panic!'));

      let farmer = {};
      let contract = {};

      sandbox.stub(framesRouter, '_getContractForShard')
        .callsArgWith(4, null, farmer, contract);

      sandbox.stub(framesRouter.network, 'getConsignmentPointer')
        .callsArgWith(3, null, { token: 'token' });

      framesRouter.addShardToFrame(request, response, function(err) {
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
      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame.addShard = sandbox.stub().callsArg(1);

      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

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
        storj.AuditStream,
        'fromRecords'
      ).throws(new Error('Invalid audit stream'));
      framesRouter.addShardToFrame(request, response, function(err) {
        expect(err.message).to.equal('Invalid audit stream');
        done();
      });
    });

    it('should return bad request if contract throws', function(done) {
      var request = httpMocks.createRequest({
        method: 'PUT',
        url: '/frames/frameid',
        params: {
          frame: 'frameid'
        },
        body: {
          index: 0,
          hash: 'notahash',
          size: -10000,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame.addShard = sandbox.stub().callsArg(1);

      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

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

      framesRouter.addShardToFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        expect(err.message)
          .to.equal('Invalid contract specification was supplied');
        done();
      });
    });

    it('should log error from mirrors query', function(done) {
      sandbox.stub(log, 'error');
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

      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });

      frame.addShard = sandbox.stub().callsArg(1);

      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, new Error('test'))
        }),
      });

      sandbox.stub(
        framesRouter,
        '_getContractForShard'
      ).callsArgWith(4, new Error('No storage offers received'));

      framesRouter.addShardToFrame(request, response, function(err) {
        expect(log.error.callCount).to.equal(1);
        expect(log.error.args[0][0]).to.equal('test');
        expect(err.message).to.equal('No storage offers received');
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

      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });

      frame.addShard = sandbox.stub().callsArg(1);

      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
      });

      sandbox.stub(
        framesRouter,
        '_getContractForShard'
      ).callsArgWith(4, new Error('No storage offers received'));

      framesRouter.addShardToFrame(request, response, function(err) {
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

      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });

      frame.addShard = sandbox.stub().callsArg(1);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

      sandbox.stub(
        framesRouter,
        '_getContractForShard',
        function(contract, audit, bl, res, callback) {
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
      ).callsArgWith(3, new Error('Cannot get token'));

      framesRouter.addShardToFrame(request, response, function(err) {
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

      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });

      frame.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);
      _frameFindOne.onCall(1).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, new Error('Cannot reload frame'))
      });

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
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
        function(contract, audit, bl, res, callback) {
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
      framesRouter.addShardToFrame(request, response, function(err) {
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

      const frame = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame.addShard = sandbox.stub()
        .callsArgWith(1, new Error('test'));

      const _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
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
        function(contract, audit, bl, res, callback) {
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

      _frameFindOne.onCall(1).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, frame)
        })
      });
      framesRouter.addShardToFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        expect(err.message).to.equal('test');
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
          parity: true,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });

      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const frame0 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame0.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame0);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.addShard = sandbox.stub().callsArg(1);
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

      var _pointerCreate = sandbox.stub(
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
        function(contract, audit, bl, res, callback) {
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
        var result = response._getData();

        expect(_pointerCreate.callCount).to.equal(1);
        expect(_pointerCreate.args[0][0].challenges.length).to.equal(3);
        expect(_pointerCreate.args[0][0].hash)
          .to.equal('cd43325b85172ca28e96785d0cb4832fd62cdf43');
        expect(_pointerCreate.args[0][0].index).to.equal(0);
        expect(_pointerCreate.args[0][0].parity).to.equal(true);
        expect(_pointerCreate.args[0][0].size).to.equal(8388608);
        expect(_pointerCreate.args[0][0].tree.length).to.equal(4);

        expect(result.farmer.nodeID).to.equal(storj.utils.rmd160('farmer'));
        expect(result.hash).to.equal(storj.utils.rmd160('data'));
        expect(result.token).to.equal('token');
        expect(result.operation).to.equal('PUSH');
        expect(testUser.recordUploadBytes.callCount).to.equal(1);
        done();
      });
      framesRouter.addShardToFrame(request, response);
    });


    it('should return data channel pointer from cached offer', function(done) {
      /* jshint maxstatements: 100 */
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
          parity: true,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });

      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const frame0 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame0.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame0);

      const farmer = {
        responseTime: 100,
        nodeID: storj.utils.rmd160('farmer'),
        address: '127.0.0.1',
        port: 8080
      };
      const contract = {
        data_hash: storj.utils.rmd160('data_hash')
      };
      const saveMirror = sandbox.stub();

      const mirrors = [
        {
          contact: { responseTime: 10100 },
          isEstablished: false
        },
        {
          contact: {},
          isEstablished: false
        },
        {
          contact: farmer,
          contract: contract,
          isEstablished: false,
          save: saveMirror
        },
        { },
        {
          contact: { responseTime: 200 },
          isEstablished: true
        },
        {
          contact: { responseTime: 4100 },
          isEstablished: true
        },
        {
          contact: { responseTime: 2100 },
          isEstablished: false
        }
      ];

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, mirrors)
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.addShard = sandbox.stub().callsArg(1);
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

      var _pointerCreate = sandbox.stub(
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
        function(contract, audit, bl, res, callback) {
          callback(null, storj.Contact({
            address: '127.0.0.1',
            port: 1337,
            nodeID: storj.utils.rmd160('farmer')
          }), contract);
        }
      );

      var _getConsignmentPointer = sandbox.stub(
        framesRouter.network,
        'getConsignmentPointer'
      ).callsArgWith(3, null, { token: 'token' });

      const item = new storj.StorageItem({ hash: storj.utils.rmd160('data') });
      sandbox.stub(item, 'addContract');
      sandbox.stub(item, 'addAuditRecords');

      sandbox.stub(framesRouter.contracts, 'load').callsArgWith(1, null, item);
      sandbox.stub(framesRouter.contracts, 'save').callsArgWith(1, null);

      response.on('end', function() {
        var result = response._getData();
        expect(_getConsignmentPointer.callCount).to.equal(1);
        expect(_getConsignmentPointer.args[0][0].nodeID)
          .to.equal(farmer.nodeID);
        expect(_getConsignmentPointer.args[0][1].get('data_hash'))
          .to.equal(storj.utils.rmd160('data_hash'));

        expect(_pointerCreate.callCount).to.equal(1);
        expect(_pointerCreate.args[0][0].challenges.length).to.equal(3);
        expect(_pointerCreate.args[0][0].hash)
          .to.equal('cd43325b85172ca28e96785d0cb4832fd62cdf43');
        expect(_pointerCreate.args[0][0].index).to.equal(0);
        expect(_pointerCreate.args[0][0].parity).to.equal(true);
        expect(_pointerCreate.args[0][0].size).to.equal(8388608);
        expect(_pointerCreate.args[0][0].tree.length).to.equal(4);

        expect(result.farmer.nodeID).to.equal(storj.utils.rmd160('farmer'));
        expect(result.hash).to.equal(storj.utils.rmd160('data'));
        expect(result.token).to.equal('token');
        expect(result.operation).to.equal('PUSH');
        expect(testUser.recordUploadBytes.callCount).to.equal(1);

        expect(saveMirror.callCount).to.equal(1);
        done();
      });
      framesRouter.addShardToFrame(request, response);
    });

    it('should get new contracts if no cached contracts available', function(done) {
      /* jshint maxstatements: 100 */
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
          parity: true,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });

      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const frame0 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame0.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame0);

      const mirrors = [
        {
          contact: { responseTime: 10100 },
          isEstablished: true
        },
        {
          contact: {},
          isEstablished: true
        },
        {
          contact: { responseTime: 200 },
          isEstablished: true
        },
        {
          contact: { responseTime: 4100 },
          isEstablished: true
        },
        {
          contact: { responseTime: 2100 },
          isEstablished: true
        }
      ];

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, mirrors)
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.addShard = sandbox.stub().callsArg(1);
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
        function(contract, audit, bl, res, callback) {
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
        expect(framesRouter._getContractForShard.callCount).to.equal(1);
        done();
      });
      framesRouter.addShardToFrame(request, response);
    });

    it('should create new storage item for cached offer', function(done) {
      /* jshint maxstatements: 100 */
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
          parity: true,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });

      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const frame0 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame0.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame0);

      const farmer = {
        responseTime: 100,
        nodeID: storj.utils.rmd160('farmer'),
        address: '127.0.0.1',
        port: 8080
      };
      const contract = {
        data_hash: storj.utils.rmd160('data_hash')
      };
      const saveMirror = sandbox.stub();

      const mirrors = [
        {
          contact: farmer,
          contract: contract,
          isEstablished: false,
          save: saveMirror
        }
      ];

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, mirrors)
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.addShard = sandbox.stub().callsArg(1);
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
        function(contract, audit, bl, res, callback) {
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

      const addContract = sandbox.stub(storj.StorageItem.prototype,
                                       'addContract');
      const addAuditRecords = sandbox.stub(storj.StorageItem.prototype,
                                           'addAuditRecords');

      sandbox.stub(framesRouter.contracts, 'load')
        .callsArgWith(1, new Error('test'));
      sandbox.stub(framesRouter.contracts, 'save').callsArgWith(1, null);

      response.on('end', function() {
        var result = response._getData();
        expect(addContract.callCount).to.equal(1);
        expect(addAuditRecords.callCount).to.equal(1);

        expect(result.farmer.nodeID).to.equal(storj.utils.rmd160('farmer'));
        expect(result.hash).to.equal(storj.utils.rmd160('data'));
        expect(result.token).to.equal('token');
        expect(result.operation).to.equal('PUSH');

        expect(framesRouter.contracts.save.callCount).to.equal(1);
        expect(framesRouter.contracts.save.args[0][0].hash)
          .to.equal(storj.utils.rmd160('data'));
        done();
      });
      framesRouter.addShardToFrame(request, response);
    });

    it('should give error if unable to save contract', function(done) {
      /* jshint maxstatements: 100 */
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
          parity: true,
          challenges: auditStream.getPrivateRecord().challenges,
          tree: auditStream.getPublicRecord()
        }
      });

      var testUser = new framesRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub().callsArg(1);
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const frame0 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame0.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame0);

      const farmer = {
        responseTime: 100,
        nodeID: storj.utils.rmd160('farmer'),
        address: '127.0.0.1',
        port: 8080
      };
      const contract = {
        data_hash: storj.utils.rmd160('data_hash')
      };
      const saveMirror = sandbox.stub();

      const mirrors = [
        {
          contact: farmer,
          contract: contract,
          isEstablished: false,
          save: saveMirror
        }
      ];

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, mirrors)
        }),
      });

      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.addShard = sandbox.stub().callsArg(1);
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

      sandbox.stub(storj.StorageItem.prototype, 'addContract');
      sandbox.stub(storj.StorageItem.prototype, 'addAuditRecords');

      sandbox.stub(framesRouter.contracts, 'load')
        .callsArgWith(1, new Error('test'));
      sandbox.stub(framesRouter.contracts, 'save')
        .callsArgWith(1, new Error('test'));

      framesRouter.addShardToFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        done();
      });
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
      testUser.isUploadRateLimited = sandbox.stub().returns(false);
      testUser.recordUploadBytes = sandbox.stub()
        .callsArgWith(1, new Error('test'));
      request.user = testUser;

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const frame0 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame0.addShard = sandbox.stub().callsArg(1);

      var _frameFindOne = sandbox.stub(
        framesRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, frame0);
      sandbox.stub(
        framesRouter.storage.models.Frame.prototype,
        'save'
      ).callsArgWith(0);

      sandbox.stub(
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
      });

      var frame1 = new framesRouter.storage.models.Frame({
        user: someUser._id
      });
      frame1.addShard = sandbox.stub().callsArg(1);
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
        function(contract, audit, bl, res, callback) {
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
      frame.addShard = sandbox.stub().callsArg(1);

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
      frame1.addShard = sandbox.stub().callsArg(1);
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
        framesRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: sandbox.stub().returns({
          exec: sandbox.stub().callsArgWith(0, null, [])
        }),
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
        function(contract, audit, bl, res, callback) {
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
      ).returns({
        limit: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, new Error('Panic!'))
        })
      });
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
      ).returns({
        limit: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, null, [frame1, frame2])
        })
      });
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
