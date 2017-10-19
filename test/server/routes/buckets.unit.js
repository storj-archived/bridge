'use strict';

const crypto = require('crypto');
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const BucketsRouter = require('../../../lib/server/routes/buckets');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const log = require('../../../lib/logger');
const analytics = require('storj-analytics');

/* jshint maxstatements:false */
describe('BucketsRouter', function() {

  const bucketsRouter = new BucketsRouter(
    require('../../_fixtures/router-opts')
  );
  const someUser = new bucketsRouter.storage.models.User({
    _id: 'gordon@storj.io',
    hashpass: storj.utils.sha256('password')
  });
  someUser.isDownloadRateLimited = sinon.stub().returns(false);
  someUser.recordDownloadBytes = sinon.stub().callsArg(1);

  describe('#_usetokenOrVerify', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('will fallback to use auth middlewares', function(done) {
      const router = new BucketsRouter(
        require('../../_fixtures/router-opts')
      );
      const rawbody = sandbox.stub().callsArg(2);
      const authenticate = sandbox.stub().callsArg(2);
      router._verify = [rawbody, authenticate];
      router._usetoken = sandbox.stub();
      const req = {
        headers: {
          'authorization': 'base64header'
        }
      };
      const res = {};
      router._usetokenOrVerify(req, res, (err) => {
        if (err) {
          return done(err);
        }
        expect(router._verify[0].callCount).to.equal(1);
        expect(router._verify[0].args[0][0]).to.equal(req);
        expect(router._verify[0].args[0][1]).to.equal(res);
        expect(router._verify[1].callCount).to.equal(1);
        expect(router._verify[1].args[0][0]).to.equal(req);
        expect(router._verify[1].args[0][1]).to.equal(res);
        expect(router._usetoken.callCount).to.equal(0);
        done();
      });
    });

    it('will pass error from rawbody middlewares', function(done) {
      const router = new BucketsRouter(
        require('../../_fixtures/router-opts')
      );
      const rawbody = sandbox.stub().callsArgWith(2, new Error('test'));
      const authenticate = sandbox.stub().callsArg(2);
      router._verify = [rawbody, authenticate];
      router._usetoken = sandbox.stub();
      const req = {
        headers: {
          'authorization': 'base64header'
        }
      };
      const res = {};
      router._usetokenOrVerify(req, res, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('test');
        done();
      });
    });

    it('will use token auth middleware', function(done) {
      const router = new BucketsRouter(
        require('../../_fixtures/router-opts')
      );
      const rawbody = sandbox.stub().callsArg(2);
      const authenticate = sandbox.stub().callsArg(2);
      router._verify = [rawbody, authenticate];
      router._usetoken = sandbox.stub().callsArg(2);
      const req = {
        headers: {
          'x-token': 'token'
        }
      };
      const res = {};
      router._usetokenOrVerify(req, res, (err) => {
        if (err) {
          return done(err);
        }
        expect(router._verify[0].callCount).to.equal(0);
        expect(router._verify[1].callCount).to.equal(0);
        expect(router._usetoken.callCount).to.equal(1);
        expect(router._usetoken.args[0][0]).to.equal(req);
        expect(router._usetoken.args[0][1]).to.equal(res);
        done();
      });
    });
  });

  describe('#_validate', function() {
    it('will callback WITH error for invalid bucket id', function(done) {
      const req = {
        params: {
          id: 'notabucketid'
        }
      };
      const res = {};
      bucketsRouter._validate(req, res, (err) => {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });

    it('will callback WITH error for invalid file id', function(done) {
      const req = {
        params: {
          file: 'notafileid'
        }
      };
      const res = {};
      bucketsRouter._validate(req, res, (err) => {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });

    it('will callback WITHOUT error for valid ids', function(done) {
      const req = {
        params: {
          id: 'bde693c900221a472b84d639',
          file: '9ec45d1e495aabd4933045bc'
        }
      };
      const res = {};
      bucketsRouter._validate(req, res, done);
    });
  });

  describe('#getBuckets', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      let chain = {};
      chain.limit = sinon.stub().returns(chain);
      chain.exec = sinon.stub().callsArgWith(0, new Error('Panic!'));
      var _bucketFind = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'find'
      ).returns(chain);
      bucketsRouter.getBuckets(request, response, function(err) {
        _bucketFind.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return buckets', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      let chain = {};
      chain.limit = sinon.stub().returns(chain);
      chain.exec = sinon.stub().callsArgWith(0, null, [
        new bucketsRouter.storage.models.Bucket({
          user: someUser._id
        })
      ]);
      var _bucketFind = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'find'
      ).returns(chain);
      response.on('end', function() {
        _bucketFind.restore();
        expect(chain.limit.callCount).to.equal(1);
        expect(chain.limit.args[0][0]).to.equal(5000);
        expect(response._getData()).to.have.lengthOf(1);
        done();
      });
      bucketsRouter.getBuckets(request, response);
    });

    it('should return buckets after date', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets',
        query: {
          startDate: '1489615902401'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      let chain = {};
      chain.limit = sinon.stub().returns(chain);
      chain.exec = sinon.stub().callsArgWith(0, null, [
        new bucketsRouter.storage.models.Bucket({
          user: someUser._id
        })
      ]);
      var _bucketFind = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'find'
      ).returns(chain);
      response.on('end', function() {
        _bucketFind.restore();
        expect(chain.limit.callCount).to.equal(1);
        expect(chain.limit.args[0][0]).to.equal(5000);
        expect(response._getData()).to.have.lengthOf(1);
        expect(_bucketFind.callCount).to.equal(1);
        expect(_bucketFind.args[0][0]).to.eql({
          user: 'gordon@storj.io',
          created: {
            $gt: 1489615902401
          }
        });
        done();
      });
      bucketsRouter.getBuckets(request, response);
    });

  });

  describe('#getBucketById', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      bucketsRouter.getBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should not found error if no bucket', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.getBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should return bucket if found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      }));
      response.on('end', function() {
        _bucketFindOne.restore();
        expect(response._getData().user).to.equal('gordon@storj.io');
        done();
      });
      bucketsRouter.getBucketById(request, response);
    });

  });


  describe('#getBucketId', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('give internal error', function(done) {
      const request = httpMocks.createRequest({
        method: 'GET',
        url: '/bucket-ids/:name',
        params: {
          name: 'base64encryptedbucketname'
        }
      });
      request.user = someUser;
      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, new Error('test'));
      bucketsRouter.getBucketId(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        expect(err.message).to.equal('test');
        done();
      });
    });

    it('give notfound error', function(done) {
      const request = httpMocks.createRequest({
        method: 'GET',
        url: '/bucket-ids/:name',
        params: {
          name: 'base64encryptedbucketname'
        }
      });
      request.user = someUser;
      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, null, null);
      bucketsRouter.getBucketId(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('give bucket id', function(done) {
      const request = httpMocks.createRequest({
        method: 'GET',
        url: '/bucket-ids/:name',
        params: {
          name: 'base64encryptedbucketname'
        }
      });
      request.user = someUser;
      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, null, { _id: '368be0816766b28fd5f43af5' });
      response.on('end', function() {
        expect(response._getData().id).to.equal('368be0816766b28fd5f43af5');
        done();
      });
      bucketsRouter.getBucketId(request, response, function(err) {
        if (err) {
          return done(err);
        }
      });
    });

  });

  describe('#createBucket', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

    it('should give error for max name length', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets',
        body: {
          pubkeys: [],
          name: crypto.randomBytes(260/2 + 1).toString('hex')
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      bucketsRouter.createBucket(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });

    it('should bad request error if invalid pubkey given', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets',
        body: {
          pubkeys: [
            'i am an invalid public key'
          ]
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      bucketsRouter.createBucket(request, response, function(err) {
        expect(err.message).to.equal('Invalid public key supplied');
        done();
      });
    });

    it('should internal error if creation fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets',
        body: {}
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketCreate = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'create'
      ).callsArgWith(2, new Error('Failed to create bucket'));
      bucketsRouter.createBucket(request, response, function(err) {
        _bucketCreate.restore();
        expect(err.message).to.equal('Failed to create bucket');
        done();
      });
    });

    it('should return the created bucket', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets',
        body: {}
      });
      request.user = someUser;
      request.pubkey = { _id: storj.KeyPair().getPublicKey() };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketCreate = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'create'
      ).callsArgWith(2, null, new bucketsRouter.storage.models.Bucket({
        user: someUser._id,
        pubkeys: [request.pubkey._id]
      }));
      response.on('end', function() {
        _bucketCreate.restore();
        expect(response._getData().pubkeys[0]).to.equal(request.pubkey._id);
        expect(response._getData().user).to.equal('gordon@storj.io');
        done();
      });
      bucketsRouter.createBucket(request, response);
    });

  });

  describe('#destroyBucketById', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}]);
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to lookup bucket'));
      bucketsRouter.destroyBucketById(request, response, function(err) {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        expect(err.message).to.equal('Failed to lookup bucket');
        done();
      });
    });

    it('should not found error if no bucket', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}]);
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.destroyBucketById(request, response, function(err) {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should log error if unable to remove bucket entries', function() {
      sandbox.stub(log, 'error');
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}]);
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        remove: sandbox.stub().callsArg(0)
      });
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'remove'
      ).callsArgWith(1, new Error('test'));
      bucketsRouter.destroyBucketById(request, response);
      expect(log.error.callCount).to.equal(1);
    });

    it('should internal error if deletion fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}]);
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArgWith(
        0,
        new Error('Failed to remove bucket')
      );
      bucketsRouter.destroyBucketById(request, response, function(err) {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        _bucketRemove.restore();
        expect(err.message).to.equal('Failed to remove bucket');
        done();
      });
    });

    it('should return 204 on success', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}]);
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArg(0);
      response.on('end', function() {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        _bucketRemove.restore();
        expect(response.statusCode).to.equal(204);
        done();
      });
      bucketsRouter.destroyBucketById(request, response);
    });

    it('should log warning if aggregation fails', function(done) {
      sandbox.stub(log, 'warn');
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, new Error('Storage event aggregation failed'), [{}, {}]);
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArg(0);
      response.on('end', function() {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        _bucketRemove.restore();
        expect(log.warn.callCount).to.equal(1);
        done();
      });
      bucketsRouter.destroyBucketById(request, response);
    });

    it('should log warning if storage events fail to save', function(done) {
      sandbox.stub(log, 'warn');
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}, {}]);
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArg(0, null);
      var _bucketEntryRemove = sinon.stub(
         bucketsRouter.storage.models.BucketEntry,
         'remove'
      ).callsArgWith(1, null);
      var _storageEventInsert = sinon.stub(
        bucketsRouter.storage.models.StorageEvent.collection,
        'insert'
      ).callsArgWith(1, new Error('Storage events failed to save'));
      response.on('end', function() {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        _bucketRemove.restore();
        _bucketEntryRemove.restore();
        _storageEventInsert.restore();
        expect(log.warn.callCount).to.equal(1);
        done();
      });
      bucketsRouter.destroyBucketById(request, response);
    });

    it('should respond with 204 when storage events get saved', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id'
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketEntryAggregate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'aggregate'
      ).callsArgWith(1, null, [{}, {}]);
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArg(0, null);
      var _bucketEntryRemove = sinon.stub(
         bucketsRouter.storage.models.BucketEntry,
         'remove'
      ).callsArgWith(1, null);
      var _storageEventInsert = sinon.stub(
        bucketsRouter.storage.models.StorageEvent.collection,
        'insert'
      ).callsArgWith(1, null);
      response.on('end', function() {
        _bucketEntryAggregate.restore();
        _bucketFindOne.restore();
        _bucketRemove.restore();
        _bucketEntryRemove.restore();
        _storageEventInsert.restore();
        expect(response.statusCode).to.equal(204);
        done();
      });
      bucketsRouter.destroyBucketById(request, response);
    });

  });

  describe('#updateBucketById', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to lookup bucket'));
      bucketsRouter.updateBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Failed to lookup bucket');
        done();
      });
    });

    it('should not found error if bucket not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.updateBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should bad request error if invalid pubkey', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket',
          pubkeys: ['some invalid public key']
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      }));
      bucketsRouter.updateBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Invalid public key supplied');
        done();
      });
    });

    it('should internal error if save fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketSave = sinon.stub(bucket, 'save').callsArgWith(
        0,
        new Error('Failed to save bucket')
      );
      bucketsRouter.updateBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketSave.restore();
        expect(err.message).to.equal('Failed to save bucket');
        done();
      });
    });

    it('should return bucket if success', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketSave = sinon.stub(bucket, 'save').callsArgWith(0);
      response.on('end', function() {
        _bucketFindOne.restore();
        _bucketSave.restore();
        expect(response._getData().user).to.equal('gordon@storj.io');
        done();
      });
      bucketsRouter.updateBucketById(request, response);
    });

  });

  describe('#_getBucketUnregistered', function() {

    it('should return internal error if query fails', function(done) {
       var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _rawBody = sinon.stub(bucketsRouter._verify, 0).callsArg(2);
      var _isPublic = sinon.stub(bucketsRouter, '_isPublic').callsArg(2);
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Query failed'));
      bucketsRouter._getBucketUnregistered(request, response, function(err) {
        _bucketFindOne.restore();
        _isPublic.restore();
        _rawBody.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should return not found if no bucket', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _rawBody = sinon.stub(bucketsRouter._verify, 0).callsArg(2);
      var _isPublic = sinon.stub(bucketsRouter, '_isPublic').callsArg(2);
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter._getBucketUnregistered(request, response, function(err) {
        _bucketFindOne.restore();
        _isPublic.restore();
        _rawBody.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should return the bucket if authenticated', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _rawBody = sinon.stub(bucketsRouter._verify, 0).callsArg(2);
      var _checkAuth = sinon.stub(bucketsRouter._verify, 1).callsArg(2);
      var _isPublic = sinon.stub(bucketsRouter, '_isPublic').callsArgWith(
        2,
        new Error('Bucket not public')
      );
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      bucketsRouter._getBucketUnregistered(request, response, function(e, b) {
        _bucketFindOne.restore();
        _checkAuth.restore();
        _isPublic.restore();
        _rawBody.restore();
        expect(b.name).to.equal('Some Bucket');
        done();
      });
    });

    it('should return the bucket if it is public', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _rawBody = sinon.stub(bucketsRouter._verify, 0).callsArg(2);
      var _isPublic = sinon.stub(bucketsRouter, '_isPublic').callsArg(2);
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      bucketsRouter._getBucketUnregistered(request, response, function(e, b) {
        _bucketFindOne.restore();
        _isPublic.restore();
        _rawBody.restore();
        expect(b.name).to.equal('Some Bucket');
        done();
      });
    });

    it('should return the bucket if the pubkey is authed', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        },
        headers: {
          'x-signature': 'signature',
          'x-pubkey': 'publickey'
        }
      });
      var middleware = require('storj-service-middleware');
      var _verifySignature = sinon.stub(
        middleware.authenticate,
        '_verifySignature'
      ).returns(true);
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _rawBody = sinon.stub(bucketsRouter._verify, 0).callsArg(2);
      var _checkAuth = sinon.stub(bucketsRouter._verify, 1).callsArgWith(
        2,
        new Error('Not authenticated')
      );
      var _isPublic = sinon.stub(bucketsRouter, '_isPublic').callsArgWith(
        2,
        new Error('Not public')
      );
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      bucketsRouter._getBucketUnregistered(request, response, function(e, b) {
        _bucketFindOne.restore();
        _isPublic.restore();
        _checkAuth.restore();
        _rawBody.restore();
        _verifySignature.restore();
        expect(b.name).to.equal('Some Bucket');
        done();
      });
    });

    it('should not authed error if not allowed', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id',
        body: {
          name: 'Some Bucket'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _rawBody = sinon.stub(bucketsRouter._verify, 0).callsArg(2);
      var _checkAuth = sinon.stub(bucketsRouter._verify, 1).callsArgWith(
        2,
        new Error('Not authenticated')
      );
      var _isPublic = sinon.stub(bucketsRouter, '_isPublic').callsArgWith(
        2,
        new Error('Not public')
      );
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      bucketsRouter._getBucketUnregistered(request, response, function(err) {
        _bucketFindOne.restore();
        _isPublic.restore();
        _checkAuth.restore();
        _rawBody.restore();
        expect(err.message).to.equal('Not authenticated');
        done();
      });
    });

  });

  describe('#createBucketToken', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

    it('should error if bucket not accessible', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PUSH'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to get bucket'));
      sandbox.stub(
        bucketsRouter.storage.models.Token,
        'create'
      ).callsArgWith(2, new Error('Failed to create token'));
      bucketsRouter.createBucketToken(request, response, function(err) {
        expect(err.message).to.equal('Failed to get bucket');
        done();
      });
    });

    it('should error if bucket not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PUSH'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.createBucketToken(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should internal error if token creation fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PUSH'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});
      sandbox.stub(
        bucketsRouter.storage.models.Token,
        'create'
      ).callsArgWith(2, new Error('Failed to create token'));
      bucketsRouter.createBucketToken(request, response, function(err) {
        expect(err.message).to.equal('Failed to create token');
        done();
      });
    });

    it('should send back token if success', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PUSH'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      var _token = new bucketsRouter.storage.models.Token({
        bucket: _bucket._id,
        operation: 'PUSH',
        _id: bucketsRouter.storage.models.Token.generate()
      });
      sandbox.stub(
        bucketsRouter.storage.models.Token,
        'create'
      ).callsArgWith(2, null, _token);
      response.on('end', function() {
        expect(response._getData().token).to.equal(_token.token);
        done();
      });
      bucketsRouter.createBucketToken(request, response);
    });

    it('should send back file info if file id is supplied', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PULL',
          file: 'fileid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      var _token = new bucketsRouter.storage.models.Token({
        bucket: _bucket._id,
        operation: 'PUSH',
        _id: bucketsRouter.storage.models.Token.generate()
      });
      sandbox.stub(
        bucketsRouter.storage.models.Token,
        'create'
      ).callsArgWith(2, null, _token);
      var frameSize = 100;
      var mimetype = 'plain/text';
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, null, {
            frame: { size: frameSize },
            mimetype: mimetype
          })
        })
      });
      response.on('end', function() {
        var data = response._getData();
        expect(data.size).to.equal(frameSize);
        expect(data.mimetype).to.equal(mimetype);
        done();
      });
      bucketsRouter.createBucketToken(request, response);
    });

    it('should call next with a database error', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PULL',
          file: 'fileid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      var _token = new bucketsRouter.storage.models.Token({
        bucket: _bucket._id,
        operation: 'PUSH',
        _id: bucketsRouter.storage.models.Token.generate()
      });
      sandbox.stub(
        bucketsRouter.storage.models.Token,
        'create'
      ).callsArgWith(2, null, _token);
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, new Error('DB error'))
        })
      });
      bucketsRouter.createBucketToken(request, response, function(err){
        expect(err.message).to.equal('DB error');
        done();
      });
    });

    it('should call next with an entry not found error', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/tokens',
        body: {
          operation: 'PULL',
          file: 'fileid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some Bucket'
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      var _token = new bucketsRouter.storage.models.Token({
        bucket: _bucket._id,
        operation: 'PUSH',
        _id: bucketsRouter.storage.models.Token.generate()
      });
      sandbox.stub(
        bucketsRouter.storage.models.Token,
        'create'
      ).callsArgWith(2, null, _token);
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, null, null)
        })
      });
      bucketsRouter.createBucketToken(request, response, function(err){
        expect(err.message).to.equal('Bucket entry not found');
        done();
      });
    });

  });

  describe('#createEntryFromFrame', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

    it('should give error with max length name', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid',
          filename: crypto.randomBytes(20000).toString('hex')
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });

    it('should internal error if bucket query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to lookup bucket'));
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Failed to lookup bucket');
        done();
      });
    });

    it('should not found error if bucket not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should internal error if frame query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, { _id: 'bucketid' });
      var _frameFindOne = sinon.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, new Error('Frame lookup failed'));
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        _frameFindOne.restore();
        expect(err.message).to.equal('Frame lookup failed');
        done();
      });
    });

    it('should not found error if frame not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, { _id: 'bucketid' });
      var _frameFindOne = sinon.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        _frameFindOne.restore();
        expect(err.message).to.equal('Frame not found');
        done();
      });
    });

    it('should bad request error if frame is locked', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, { _id: 'bucketid' });
      var _frameFindOne = sinon.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, { locked: true });
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        _frameFindOne.restore();
        expect(err.message).to.equal('Frame is already locked');
        done();
      });
    });

    it('should internal error if bucket entry creation fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, { _id: 'bucketid' });
      var _frameFindOne = sinon.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, { locked: false });
      var _bucketEntryCreate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'create'
      ).callsArgWith(1, new Error('Failed to create entry'));
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        _frameFindOne.restore();
        _bucketEntryCreate.restore();
        expect(err.message).to.equal('Failed to create entry');
        done();
      });
    });

    it('should internal error if frame lock fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, { _id: 'bucketid' });
      var _frameFindOne = sinon.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, {
        locked: false,
        lock: sinon.stub().callsArgWith(0, new Error('Cannot lock frame'))
      });
      var _bucketEntryCreate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'create'
      ).callsArgWith(1, null, {});
      bucketsRouter.createEntryFromFrame(request, response, function(err) {
        _bucketFindOne.restore();
        _frameFindOne.restore();
        _bucketEntryCreate.restore();
        expect(err.message).to.equal('Cannot lock frame');
        done();
      });
    });

    it('should send back bucket entry if success', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid',
          mimetype: 'application/octet-stream',
          filename: 'somefilename',
          hmac: {
            value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
              'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
              'b5e37e3f5c8',
            type: 'sha512'
          },
          erasure: {
            type: 'reedsolomon'
          },
          index: '0c8b74d283a4d52a32332d622bd66fdf67f7c80eed3a2854da1df0a56f7135bb'
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      function StorageEvent(data) {
        expect(data.storage).to.equal(12345);
      }
      StorageEvent.prototype.save = sandbox.stub().callsArgWith(0, null);
      sandbox.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
      );
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, { _id: 'bucketid' });
      sandbox.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'frameid',
        locked: false,
        storageSize: 12345,
        lock: sandbox.stub().callsArg(0)
      });
      const hmac = {
        value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
          'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
          'b5e37e3f5c8',
        type: 'sha512'
      };
      var entry = { frame: 'frameid', bucket: 'bucketid', hmac: hmac};
      var _bucketEntryCreate = sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'create'
      ).callsArgWith(1, null, {
        toObject: sandbox.stub().returns(entry)
      });
      response.on('end', function() {
        expect(response._getData().frame).to.equal('frameid');
        expect(_bucketEntryCreate.args[0][0]).to.eql({
          bucket: 'bucketid',
          frame: 'frameid',
          hmac: {
            type: 'sha512',
            value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
              'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
              'b5e37e3f5c8'
          },
          erasure: {
            type: 'reedsolomon'
          },
          mimetype: 'application/octet-stream',
          name: 'somefilename',
          index: '0c8b74d283a4d52a32332d622bd66fdf67f7c80eed3a2854da1df0a56f7135bb'
        });
        expect(response._getData().hmac).to.eql(hmac);
        expect(response._getData().bucket).to.equal('bucketid');
        done();
      });
      bucketsRouter.createEntryFromFrame(request, response);
    });

     it('should return internal error if storage event save fails', function(done) {
       sandbox.stub(log,'warn');
        var request = httpMocks.createRequest({
        method: 'POST',
        url: '/buckets/:bucket_id/files',
        body: {
          frame: 'frameid',
          mimetype: 'application/octet-stream',
          filename: 'somefilename',
          hmac: {
            value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
              'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
              'b5e37e3f5c8',
            type: 'sha512'
          }
        },
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'bucketid'
      });
      sandbox.stub(
        bucketsRouter.storage.models.Frame,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'frameid',
        locked: false,
        lock: sandbox.stub().callsArg(0),
      });
      const hmac = {
        value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
          'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
          'b5e37e3f5c8',
        type: 'sha512'
      };
      var entry = { frame: 'frameid', bucket: 'bucketid', hmac: hmac};
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'create'
      ).callsArgWith(1, null, {
        _id: 'bucketentryid',
        frame: 'frameid',
        toObject: sandbox.stub().returns(entry)
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sandbox.stub().callsArgWith(0, new Error('test'));
      sandbox.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
      );
      response.on('end', function() {
        expect(log.warn.callCount).to.equal(1);
        done();
      });
      bucketsRouter.createEntryFromFrame(request, response);
    });

  });

  describe('#_getBucketById', function() {

    it('should filter by user id if supplied', function(done) {
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne',
        function(query) {
          _bucketFindOne.restore();
          expect(query.user).to.equal('user@email.com');
          done();
        }
      );
      bucketsRouter._getBucketById('bucketid', 'user@email.com');
    });

    it('should internal error if query fails', function(done) {
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Query failed'));
      bucketsRouter._getBucketById('bucketid', function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should not found error if bucket not found', function(done) {
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter._getBucketById('bucketid', function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should return bucket', function(done) {
      var _bucket = new bucketsRouter.storage.models.Bucket({
        name: 'Some bucket'
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, _bucket);
      bucketsRouter._getBucketById('bucketid', function(err, bucket) {
        _bucketFindOne.restore();
        expect(bucket.name).to.equal('Some bucket');
        done();
      });
    });

  });

  describe('#getBucketEntryById', function() {

    it('should internal error if query fails', function(done) {
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, new Error('Query failed'))
      });
      bucketsRouter.getBucketEntryById('bucketid', 'entryid', function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should not found error if entry not found', function(done) {
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, null, null)
      });
      bucketsRouter.getBucketEntryById('bucketid', 'entryid', function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Entry not found');
        done();
      });
    });

    it('should return the bucket entry', function(done) {
      var _bucketEntry = new bucketsRouter.storage.models.BucketEntry({

      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, null, _bucketEntry)
      });
      bucketsRouter.getBucketEntryById('bucketid', 'entryid', function(e, be) {
        _bucketFindOne.restore();
        expect(be).to.equal(_bucketEntry);
        done();
      });
    });

  });

  describe('#getPointersForEntry', function() {

    it('should internal error if query fails', function(done) {
      var _pointerFind = sinon.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, new Error('Query failed'));
      bucketsRouter.getPointersForEntry({
        frame: { shards: [] }
      }, function(err) {
        _pointerFind.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should return pointers', function(done) {
      var _pointerFind = sinon.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, null, []);
      bucketsRouter.getPointersForEntry({
        frame: { shards: [] }
      }, function(err, p) {
        _pointerFind.restore();
        expect(Array.isArray(p)).to.equal(true);
        done();
      });
    });

  });

  describe('#getMirrorsForPointers', function() {

    it('should return a mirror map from pointers', function(done) {
      var _mirrorFind = sinon.stub(
        bucketsRouter.storage.models.Mirror,
        'find'
      ).callsArgWith(1, null, [{},{},{}]);
      bucketsRouter.getMirrorsForPointers([
        { hash: 'hash1' },
        { hash: 'hash2' },
        { hash: 'hash3' }
      ], function(err, results) {
        _mirrorFind.restore();
        expect(results).to.have.lengthOf(3);
        expect(results[0]).to.have.lengthOf(3);
        expect(results[1]).to.have.lengthOf(3);
        expect(results[2]).to.have.lengthOf(3);
        done();
      });
    });

  });

  describe('#getContactById', function() {

    it('should internal error if query fails', function(done) {
      var _contactFindOne = sinon.stub(
        bucketsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, new Error('Query failed'));
      bucketsRouter.getContactById('nodeid', function(err) {
        _contactFindOne.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should not found error if contact not found', function(done) {
      var _contactFindOne = sinon.stub(
        bucketsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.getContactById('nodeid', function(err) {
        _contactFindOne.restore();
        expect(err.message).to.equal('Contact not found');
        done();
      });
    });

    it('should return the contact', function(done) {
      var _contact = new bucketsRouter.storage.models.Contact({
        _id: 'nodeid',
        address: '0.0.0.0',
        port: 1337
      });
      var _contactFindOne = sinon.stub(
        bucketsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, _contact);
      bucketsRouter.getContactById('nodeid', function(err, c) {
        _contactFindOne.restore();
        expect(c.nodeID).to.equal('nodeid');
        done();
      });
    });

  });

  describe('#getMirrorAuthorization', function() {

    it('should internal error if cannot load contract', function(done) {
      var _load = sinon.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Failed to load item'));
      bucketsRouter.getMirrorAuthorization({}, function(err) {
        _load.restore();
        expect(err.message).to.equal('Failed to load item');
        done();
      });
    });

    it('should internal error if contacts cannot load', function(done) {
      var _load = sinon.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, new storj.StorageItem({
        contracts: {
          nodeid: {
            data_hash: storj.utils.rmd160('')
          }
        }
      }));
      var _getContact = sinon.stub(
        bucketsRouter,
        'getContactById'
      ).callsArgWith(1, new Error('Failed to find contact'));
      bucketsRouter.getMirrorAuthorization({}, function(err) {
        _load.restore();
        _getContact.restore();
        expect(err.message).to.equal('Failed to find contact');
        done();
      });
    });

    it('should internal error if cannot get pointer', function(done) {
      var _load = sinon.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, new storj.StorageItem({
        contracts: {
          nodeid: {
            data_hash: storj.utils.rmd160('')
          }
        }
      }));
      var _getContact = sinon.stub(
        bucketsRouter,
        'getContactById'
      ).callsArgWith(1, null, {
        nodeID: storj.utils.rmd160('1'),
        address: '0.0.0.0',
        port: 1337
      });
      var _getRetrievalPointer = sinon.stub(
        bucketsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, new Error('Failed to get token'));
      bucketsRouter.getMirrorAuthorization({}, function(err) {
        _load.restore();
        _getContact.restore();
        _getRetrievalPointer.restore();
        expect(err.message).to.equal('Failed to get token');
        done();
      });
    });

    it('should return mirror authorization', function(done) {
      var _load = sinon.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, new storj.StorageItem({
        contracts: {
          nodeid: {
            data_hash: storj.utils.rmd160('')
          }
        }
      }));
      var _getContact = sinon.stub(
        bucketsRouter,
        'getContactById'
      ).callsArgWith(1, null, {
        nodeID: storj.utils.rmd160('1'),
        address: '0.0.0.0',
        port: 1337
      });
      var dcp = {};
      var _getRetrievalPointer = sinon.stub(
        bucketsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, dcp);
      bucketsRouter.getMirrorAuthorization({}, function(err, result) {
        _load.restore();
        _getContact.restore();
        _getRetrievalPointer.restore();
        expect(dcp).to.equal(result.source);
        done();
      });
    });

  });

  describe('#getMirroringTokens', function() {

    it('should get mirror authorizations for each token', function(done) {
      var _getMirrorAuth = sinon.stub(
        bucketsRouter,
        'getMirrorAuthorization'
      ).callsArgWith(1, null, 'token');
      bucketsRouter.getMirroringTokens(
        [['mirror', 'mirror'], ['mirror','mirror']],
        function(err, tokenMap) {
          _getMirrorAuth.restore();
          expect(tokenMap[0][0]).to.equal('token');
          expect(tokenMap[0][1]).to.equal('token');
          expect(tokenMap[1][0]).to.equal('token');
          expect(tokenMap[1][1]).to.equal('token');
          done();
        }
      );
    });

  });

  describe('#createMirrorsFromTokenMap', function() {

    it('should internal error if cannot load contract', function(done) {
      var _load = sinon.stub(bucketsRouter.contracts, 'load').callsArgWith(
        1,
        new Error('Failed to load item')
      );
      bucketsRouter.createMirrorsFromTokenMap([
        [],
        [{
          source: {},
          destination: {},
          mirror: {}
        }]
      ], function(err) {
        _load.restore();
        expect(err.message).to.equal('Failed to load item');
        done();
      });
    });

    it('should internal error if mirror fails to save', function(done) {
      var _load = sinon.stub(bucketsRouter.contracts, 'load').callsArgWith(
        1,
        null,
        new storj.StorageItem({ hash: storj.utils.rmd160('') })
      );
      bucketsRouter.createMirrorsFromTokenMap([
        [{
          source: {},
          destination: storj.Contact({
            address: '0.0.0.0',
            port: 1337,
            nodeID: storj.utils.rmd160('')
          }),
          mirror: {
            contract: storj.Contract({ data_hash: storj.utils.rmd160('') }),
            save: sinon.stub().callsArgWith(0, new Error('Failed to save'))
          }
        }]
      ], function(err) {
        _load.restore();
        expect(err.message).to.equal('Failed to save');
        done();
      });
    });

    it('should internal error if contract cannot save', function(done) {
      var _load = sinon.stub(bucketsRouter.contracts, 'load').callsArgWith(
        1,
        null,
        new storj.StorageItem({ hash: storj.utils.rmd160('') })
      );
      var _save = sinon.stub(bucketsRouter.contracts, 'save').callsArgWith(
        1,
        new Error('Failed to save item')
      );
      bucketsRouter.createMirrorsFromTokenMap([
        [{
          source: {},
          destination: storj.Contact({
            address: '0.0.0.0',
            port: 1337,
            nodeID: storj.utils.rmd160('')
          }),
          mirror: {
            contract: storj.Contract({ data_hash: storj.utils.rmd160('') }),
            save: sinon.stub().callsArg(0)
          }
        }]
      ], function(err) {
        _load.restore();
        _save.restore();
        expect(err.message).to.equal('Failed to save item');
        done();
      });
    });

    it('should mirror the data to the mirrors in the map', function(done) {
      var _load = sinon.stub(bucketsRouter.contracts, 'load').callsArgWith(
        1,
        null,
        new storj.StorageItem({ hash: storj.utils.rmd160('') })
      );
      var _save = sinon.stub(bucketsRouter.contracts, 'save').callsArgWith(
        1,
        null
      );
      var _getMirrorNodes = sinon.stub(
        bucketsRouter.network,
        'getMirrorNodes'
      ).callsArg(2);
      bucketsRouter.createMirrorsFromTokenMap([
        [{
          source: {},
          destination: storj.Contact({
            address: '0.0.0.0',
            port: 1337,
            nodeID: storj.utils.rmd160('')
          }),
          mirror: {
            contract: storj.Contract({ data_hash: storj.utils.rmd160('') }),
            save: sinon.stub().callsArg(0)
          }
        }]
      ], function() {
        _load.restore();
        _save.restore();
        _getMirrorNodes.restore();
        done();
      });
    });

  });

  describe('#_getRetrievalToken', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should internal error if contract cannot load', function(done) {
      sandbox.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Failed to load item'));
      bucketsRouter._getRetrievalToken({}, {}, function(err) {
        expect(err.message).to.equal('Failed to load item');
        done();
      });
    });

    it('should callback after timeout, not double, w/ data', function(done) {
      sandbox.stub(log, 'warn');
      sandbox.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, new storj.StorageItem({}));
      var clock = sandbox.useFakeTimers();
      sandbox.stub(
        bucketsRouter.storage.models.Contact,
        'find'
      ).callsArgWith(1, null, [
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid'),
          address: '0.0.0.0',
          port: 1234
        })
      ]);
      sandbox.stub(
        bucketsRouter,
        '_requestRetrievalPointer',
        function(item, meta, cb) {
          setTimeout(cb, 22000);
        }
      );
      const sPointer = {
        index: 12,
        hash: 'shardhash',
        size: 65536,
        parity: true
      };
      bucketsRouter._getRetrievalToken(sPointer, {}, function(err, result) {
        setImmediate(() => {
          if (err) {
            return done(err);
          }
          expect(result).to.eql({
            index: 12,
            hash: 'shardhash',
            size: 65536,
            parity: true
          });
          expect(log.warn.callCount).to.equal(1);
          expect(result.token).to.equal(undefined);
          expect(result.operation).to.equal(undefined);
          expect(result.farmer).to.equal(undefined);
          done();
        });
      });
      clock.tick(22000);
    });

    it('should callback error if query fails', function(done) {
      sandbox.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, new storj.StorageItem({}));
      sandbox.stub(
        bucketsRouter.storage.models.Contact,
        'find'
      ).callsArgWith(1, new Error('Query failed'));
      bucketsRouter._getRetrievalToken({}, {}, function(err) {
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should log error if no token retrieved, give w/ data', function(done) {
      sandbox.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, storj.StorageItem({
        hash: storj.utils.rmd160(''),
        contracts: {
          nodeid1: { data_hash: storj.utils.rmd160('') },
          nodeid2: { data_hash: storj.utils.rmd160('') },
          nodeid3: { data_hash: storj.utils.rmd160('') }
        }
      }));
      sandbox.stub(
        bucketsRouter.storage.models.Contact,
        'find'
      ).callsArgWith(1, null, [
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid1'),
          address: '0.0.0.0',
          port: 1234,
          lastSeen: 10
        }),
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid2'),
          address: '0.0.0.0',
          port: 1234,
          lastSeen: 3
        }),
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid3'),
          address: '0.0.0.0',
          port: 1234,
          lastSeen: 12
        })
      ]);
      sandbox.stub(
        bucketsRouter,
        '_requestRetrievalPointer',
        function(item, options, next) {
          next();
        }
      );
      const sPointer = {
        index: 12,
        hash: 'shardhash',
        size: 65536,
        parity: true
      };
      bucketsRouter._getRetrievalToken(sPointer, {
        excludeFarmers: ['nodeid3']
      }, function(err, result) {
        if (err) {
          return done(err);
        }
        expect(result).to.eql({
          index: 12,
          hash: 'shardhash',
          size: 65536,
          parity: true
        });
        done();
      });
    });

    it('should callback with pointer when received', function(done) {
      sandbox.stub(
        bucketsRouter.contracts,
        'load'
      ).callsArgWith(1, null, storj.StorageItem({
        hash: storj.utils.rmd160(''),
        contracts: {
          nodeid1: { data_hash: storj.utils.rmd160('') },
          nodeid2: { data_hash: storj.utils.rmd160('') },
          nodeid3: { data_hash: storj.utils.rmd160('') }
        }
      }));
      sandbox.stub(
        bucketsRouter,
        '_requestRetrievalPointer',
        function(item, options, next) {
          options.pointer = {
            token: options.contact.nodeID === storj.utils.rmd160('nodeid2') ?
              'correct token' :
              'incorrect token'
          };
          next(null, true);
        }
      );
      sandbox.stub(
        bucketsRouter.storage.models.Contact,
        'find'
      ).callsArgWith(1, null, [
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid1'),
          address: '0.0.0.0',
          port: 1234,
          lastSeen: Date.now() - 2000,
          lastTimeout: Date.now() - 1000
        }),
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid2'),
          address: '0.0.0.0',
          port: 1234,
          lastSeen: 12
        }),
        new bucketsRouter.storage.models.Contact({
          _id: storj.utils.rmd160('nodeid3'),
          address: '0.0.0.0',
          port: 1234,
          lastSeen: 3
        })
      ]);
      bucketsRouter._getRetrievalToken({}, {
        excludeFarmers: ['nodeid3']
      }, function(err, result) {
        expect(result.token).to.equal('correct token');
        done();
      });
    });

  });

  describe('#_requestRetrievalPointer', function() {

    it('should callback false if cannot get pointer', function(done) {
      var _contactFindOne = sinon.stub(
        bucketsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, {
        address: '0.0.0.0',
        port: 1337,
        nodeID: storj.utils.rmd160('nodeid')
      });
      var _getRetrievalPointer = sinon.stub(
        bucketsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, new Error('Failed to get pointer'));
      var contracts = {};
      contracts[storj.utils.rmd160('nodeid')] = {
        data_hash: storj.utils.rmd160('')
      };
      bucketsRouter._requestRetrievalPointer(storj.StorageItem({
        hash: storj.utils.rmd160(''),
        contracts: contracts
      }), {
        contact: new storj.Contact({
          nodeID: storj.utils.rmd160('nodeid'),
          address: '0.0.0.0',
          port: 1234
        }),
        pointer: null
      }, function(err, result) {
        _contactFindOne.restore();
        _getRetrievalPointer.restore();
        expect(err).to.equal(null);
        expect(result).to.equal(false);
        done();
      });
    });

    it('should callback empty if response has no token', function(done) {
      var _contactFindOne = sinon.stub(
        bucketsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, {
        address: '0.0.0.0',
        port: 1337,
        nodeID: storj.utils.rmd160('nodeid')
      });
      var _getRetrievalPointer = sinon.stub(
        bucketsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, {});
      var contracts = {};
      contracts[storj.utils.rmd160('nodeid')] = {
        data_hash: storj.utils.rmd160('')
      };
      bucketsRouter._requestRetrievalPointer(storj.StorageItem({
        hash: storj.utils.rmd160(''),
        contracts: contracts
      }), {
        contact: new storj.Contact({
          nodeID: storj.utils.rmd160('nodeid'),
          address: '0.0.0.0',
          port: 1234
        }),
        pointer: null
      }, function(err, result) {
        _contactFindOne.restore();
        _getRetrievalPointer.restore();
        expect(err).to.equal(undefined);
        expect(result).to.equal(undefined);
        done();
      });
    });

    it('should add download count to item if not there', function(done) {
      var _contactFindOne = sinon.stub(
        bucketsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, {
        address: '0.0.0.0',
        port: 1337,
        nodeID: storj.utils.rmd160('nodeid')
      });
      var _getRetrievalPointer = sinon.stub(
        bucketsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, {
        token: 'token'
      });
      var contracts = {};
      contracts[storj.utils.rmd160('nodeid')] = {
        data_hash: storj.utils.rmd160('')
      };
      var item = storj.StorageItem({
        hash: storj.utils.rmd160(''),
        contracts: contracts
      });
      var _save = sinon.stub(
        bucketsRouter.contracts,
        'save'
      ).callsArg(1);
      var meta = {
        contact: new storj.Contact({
          nodeID: storj.utils.rmd160('nodeid'),
          address: '0.0.0.0',
          port: 1234
        }),
        pointer: null
      };
      bucketsRouter._requestRetrievalPointer(item, meta, function(err) {
        _save.restore();
        _contactFindOne.restore();
        _getRetrievalPointer.restore();
        expect(err).to.equal(null);
        expect(meta.pointer.token).to.equal('token');
        expect(meta.pointer.farmer.nodeID).to.equal(storj.utils.rmd160('nodeid'));
        done();
      });
    });

  });

  describe('#_getPointersFromEntry', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should internal error if query fails', function(done) {
      var _pointerFind = sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        skip: function() {
          return this;
        },
        limit: function() {
          return this;
        },
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, new Error('Query failed'))
      });
      const user = someUser;
      bucketsRouter._getPointersFromEntry({
        frame: { shards: [] }
      }, {
        skip: 6,
        limit: 12
      }, user, function(err) {
        _pointerFind.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('record bytes and log on error', function(done) {
      sandbox.stub(log, 'warn');

      const testUser = new bucketsRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isDownloadRateLimited = sandbox.stub().returns(true);
      testUser.recordDownloadBytes = sandbox.stub()
        .callsArgWith(1, new Error('test'));
      const pointers = [{ size: 1 }, { size: 10 }, { size: 5 }];
      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        skip: function() {
          return this;
        },
        limit: function() {
          return this;
        },
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, pointers)
      });

      sandbox.stub(
        bucketsRouter,
        '_getRetrievalToken'
      ).callsArgWith(2, null, {});

      bucketsRouter._getPointersFromEntry({
        frame: { shards: [] }
      }, {
        skip: 6,
        limit: 12
      }, testUser, function(err) {
        if (err) {
          return done(err);
        }
        expect(log.warn.callCount).to.equal(1);
        expect(testUser.recordDownloadBytes.args[0][0]).to.equal(16);
        done();
      });
    });

    it('will give error if bytes not finite', function(done) {
      sandbox.stub(log, 'warn');

      const testUser = new bucketsRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isDownloadRateLimited = sandbox.stub().returns(true);
      testUser.recordDownloadBytes = sandbox.stub()
        .callsArgWith(1, new Error('test'));

      const pointers = [{ size: NaN }, { size: NaN }, { size: NaN }];

      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        skip: function() {
          return this;
        },
        limit: function() {
          return this;
        },
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, pointers)
      });
      sandbox.stub(
        bucketsRouter,
        '_getRetrievalToken'
      ).callsArgWith(2, null, {});

      bucketsRouter._getPointersFromEntry({
        frame: { shards: [] }
      }, {
        skip: 6,
        limit: 12
      }, testUser, function(err) {
        expect(err.message).to.equal('Pointer size in not a finite number');
        done();
      });
    });

    it('will sum gte and lt correctly w/ strings', function(done) {
      const pointers = [];

      const find = sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, pointers)
      });

      sandbox.stub(
        bucketsRouter,
        '_getRetrievalToken'
      ).callsArgWith(2, null, {});

      bucketsRouter._getPointersFromEntry({
        frame: { shards: [] }
      }, {
        skip: '4',
        limit: '1'
      }, someUser, function() {
        expect(find.callCount).to.equal(1);
        expect(find.args[0][0].index.$gte).to.equal(4);
        expect(find.args[0][0].index.$lt).to.equal(5);
        done();
      });
    });

    it('should internal error if any retreive token fails', function(done) {
      var _pointerFind = sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        skip: function() {
          return this;
        },
        limit: function() {
          return this;
        },
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, [{size: 10}])
      });
      var _getRetrievalToken = sandbox.stub(
        bucketsRouter,
        '_getRetrievalToken'
      ).callsArgWith(2, new Error('Failed to get token'));
      bucketsRouter._getPointersFromEntry({
        frame: { shards: [] }
      }, {
        skip: 6,
        limit: 12
      }, someUser, function(err) {
        _pointerFind.restore();
        _getRetrievalToken.restore();
        expect(err.message).to.equal('Failed to get token');
        done();
      });
    });

    it('should callback with results', function(done) {
      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        skip: function() {
          return this;
        },
        limit: function() {
          return this;
        },
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, [{size: 10}])
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, null);
      sandbox.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
      );
      var token = {};
      sandbox.stub(
        bucketsRouter,
        '_getRetrievalToken'
      ).callsArgWith(2, null, token);
      bucketsRouter._getPointersFromEntry({
        bucket: 'bucketid',
        _id: 'bucketentryid',
        frame: { shards: [] }
      }, {
        skip: 6,
        limit: 12
      }, someUser, function(err, results) {
        if (err) {
          return done(err);
        }
        expect(results[0]).to.equal(token);
        expect(bucketsRouter.storage.models.StorageEvent.prototype.save.callCount).to.equal(1);
        expect(bucketsRouter.storage.models.StorageEvent.args[0][0]).to.eql({
          bucket: 'bucketid',
          bucketEntry: 'bucketentryid',
          downloadBandwidth: 10,
          storage: 0,
          user: 'gordon@storj.io'
        });
        done();
      });
    });

    it('should throw error if storage event save fails', function(done) {
      sandbox.stub(log, 'warn');
      const testUser = new bucketsRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isDownloadRateLimited = sandbox.stub().returns(false);
      testUser.recordDownloadBytes = sandbox.stub().callsArgWith(1, null);
      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).returns({
        skip: function() {
          return this;
        },
        limit: function() {
          return this;
        },
        sort: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, [{size: 10}])
      });
      sandbox.stub(
        bucketsRouter,
        '_getRetrievalToken'
      ).callsArgWith(2, null, {});
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, new Error('test'));
      sandbox.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
      );
      bucketsRouter._getPointersFromEntry({
        frame: { shards: [] }
      }, {
        skip: 6,
        limit: 12
      }, testUser, function() {
        expect(log.warn.callCount).to.equal(1);
        done();
      });
    });

  });

  describe('#getFile', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(() => sandbox.stub(analytics, 'track'));
    afterEach(() => sandbox.restore());

    it('should limit user if limit has been reached', function(done) {
      const request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      const testUser = new bucketsRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isDownloadRateLimited = sinon.stub().returns(true);
      testUser.recordDownloadBytes = sinon.stub().callsArg(1);

      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, testUser);

      bucketsRouter.getFile(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.TransferRateError);
        expect(err.message)
          .to.equal('Could not get file, transfer rate limit reached.');
        done();
      });
    });

    it('should not authorized error if token is invalid', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'notthebucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      bucketsRouter.getFile(request, response, function(err) {
        expect(err.message).to.equal('Not authorized');
        done();
      });
    });

    it('should internal error if bucket query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Query failed'));

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);

      bucketsRouter.getFile(request, response, function(err) {
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should internal error if user query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {user: 'userid'});

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, new Error('user test'));

      bucketsRouter.getFile(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        expect(err.message).to.equal('user test');
        done();
      });
    });

    it('should 404 if user query is not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {user: 'userid'});

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, null);

      bucketsRouter.getFile(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        expect(err.message).to.equal('User not found for bucket');
        done();
      });
    });

    it('should not found error if bucket not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);

      bucketsRouter.getFile(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should internal error if bucket entry query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'bucketid',
      });

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);

      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, new Error('Query failed'))
      });

      bucketsRouter.getFile(request, response, function(err) {
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should not found error if bucket entry not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        }
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'bucketid',
      });

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);

      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, null)
      });

      bucketsRouter.getFile(request, response, function(err) {
        expect(err.message).to.equal('File not found');
        done();
      });
    });

    it('should internal error if fails to get pointers', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        },
        query: {}
      });
      request.token = {
        bucket: 'bucketid'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'bucketid',
      });

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);

      var entry = {
        frame: {
          size: 1024 * 8
        }
      };
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, entry)
      });
      sandbox.stub(
        bucketsRouter,
        '_getPointersFromEntry'
      ).callsArgWith(3, new Error('Failed to get token'));
      bucketsRouter.getFile(request, response, function(err) {
        expect(err.message).to.equal('Failed to get token');
        done();
      });
    });

    it('should send retrieval pointers', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        },
        query: {}
      });
      request.token = {
        bucket: 'bucketid'
      };
      const testUser = new bucketsRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isDownloadRateLimited = sinon.stub().returns(false);
      testUser.recordDownloadBytes = sinon.stub().callsArg(1);

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'bucketid',
      });

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, testUser);

      var entry = {
        frame: {
          size: 1024 * 8
        }
      };
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, entry)
      });
      var pointers = [{ pointer: 'one' }, { pointer: 'two' }];
      sandbox.stub(
        bucketsRouter,
        '_getPointersFromEntry'
      ).callsArgWith(3, null, pointers);
      response.on('end', function() {
        expect(bucketsRouter.storage.models.Bucket.findOne.args[0][0])
          .to.eql({ _id: 'bucketid' });
        expect(bucketsRouter._getPointersFromEntry.args[0][2])
          .to.equal(testUser);
        expect(JSON.stringify(response._getData())).to.equal(
          JSON.stringify(pointers)
        );
        done();
      });
      bucketsRouter.getFile(request, response);
    });

    it('should send retrieval pointers w/o token (w/ user)', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid'
        },
        query: {}
      });
      request.user = someUser;
      const testUser = new bucketsRouter.storage.models.User({
        _id: 'testuser@storj.io',
        hashpass: storj.utils.sha256('password')
      });
      testUser.isDownloadRateLimited = sinon.stub().returns(false);
      testUser.recordDownloadBytes = sinon.stub().callsArg(1);

      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {
        _id: 'bucketid',
      });

      sandbox.stub(
        bucketsRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, testUser);

      var entry = {
        frame: {
          size: 1024 * 8
        }
      };
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sandbox.stub().callsArgWith(0, null, entry)
      });
      var pointers = [{ pointer: 'one' }, { pointer: 'two' }];
      sandbox.stub(
        bucketsRouter,
        '_getPointersFromEntry'
      ).callsArgWith(3, null, pointers);
      response.on('end', function() {
        expect(bucketsRouter.storage.models.Bucket.findOne.args[0][0])
          .to.eql({ _id: 'bucketid', user: 'gordon@storj.io' });
        expect(bucketsRouter._getPointersFromEntry.args[0][2])
          .to.equal(testUser);
        expect(JSON.stringify(response._getData())).to.equal(
          JSON.stringify(pointers)
        );
        done();
      });
      bucketsRouter.getFile(request, response);
    });

  });

  describe('#listMirrorsForFile', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should return the mirrors for the file', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/mirrors',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter,
        '_getBucketById'
      ).callsArgWith(2, null, {
        id: 'bucketid'
      });
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, {
              frame: { shards: [] }
            })
          };
        }
      });
      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, null, [
        { hash: 'hash1' },
        { hash: 'hash2' }
      ]);
      sandbox.stub(
        bucketsRouter.storage.models.Shard,
        'findOne'
      ).returns({
        exec: sandbox.stub().callsArgWith(0, null, {
          contracts: [
            {
              contract: {
                farmer_id: 'farmer_id',
                data_size: 123456,
                store_begin: 1501721184170,
                store_end: 1501721192741
              }
            }
          ]
        })
      });
      response.on('end', () => {
        let data = response._getData();
        expect(data).to.have.lengthOf(2);
        expect(data[0].established).to.have.lengthOf(1);
        expect(data[0].available).to.have.lengthOf(0);
        expect(data[1].established).to.have.lengthOf(1);
        expect(data[1].available).to.have.lengthOf(0);
        done();
      });
      bucketsRouter.listMirrorsForFile(request, response);
    });

    it('should handle shard not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/mirrors',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter,
        '_getBucketById'
      ).callsArgWith(2, null, {
        id: 'bucketid'
      });
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, {
              frame: { shards: [] }
            })
          };
        }
      });
      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, null, [
        { hash: 'hash1' },
        { hash: 'hash2' }
      ]);
      sandbox.stub(
        bucketsRouter.storage.models.Shard,
        'findOne'
      ).returns({
        exec: sandbox.stub().callsArgWith(0, null)
      });
      response.on('end', () => {
        let data = response._getData();
        expect(data).to.have.lengthOf(2);
        expect(data[0].established).to.have.lengthOf(0);
        expect(data[0].available).to.have.lengthOf(0);
        expect(data[1].established).to.have.lengthOf(0);
        expect(data[1].available).to.have.lengthOf(0);
        done();
      });
      bucketsRouter.listMirrorsForFile(request, response);
    });

    it('should error if it fails to find mirror', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/mirrors',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter,
        '_getBucketById'
      ).callsArgWith(2, null, {
        id: 'bucketid'
      });
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, {
              frame: { shards: [] }
            })
          };
        }
      });
      sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, null, [
        { hash: 'hash1' },
        { hash: 'hash2' }
      ]);
      sandbox.stub(
        bucketsRouter.storage.models.Shard,
        'findOne'
      ).returns({
        exec: sandbox.stub().callsArgWith(
          0, new Error('Failed to find mirror')
        )
      });
      bucketsRouter.listMirrorsForFile(request, response, (err) => {
        expect(err.message).to.equal('Failed to find mirror');
        done();
      });
    });

    it('should error if it fails to find pointers', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/mirrors',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _getBucketById = sandbox.stub(
        bucketsRouter,
        '_getBucketById'
      ).callsArgWith(2, null, {
        id: 'bucketid'
      });
      var _bucketEntryFindOne = sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, {
              frame: { shards: [] }
            })
          };
        }
      });
      var _pointerFind = sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, new Error('Failed to find pointers'));
      var _mirrorFind = sandbox.stub(
        bucketsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, [
              {
                toObject: (() => 'MIRROR'),
                isEstablished: true
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }
            ])
          };
        }
      });
      bucketsRouter.listMirrorsForFile(request, response, (err) => {
        _getBucketById.restore();
        _bucketEntryFindOne.restore();
        _pointerFind.restore();
        _mirrorFind.restore();
        expect(err.message).to.equal('Failed to find pointers');
        done();
      });
    });

    it('should error if it fails to lookup bucket entry', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/mirrors',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _getBucketById = sandbox.stub(
        bucketsRouter,
        '_getBucketById'
      ).callsArgWith(2, null, {
        id: 'bucketid'
      });
      var _bucketEntryFindOne = sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, new Error('Query failed'))
          };
        }
      });
      var _pointerFind = sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, null, [
        { hash: 'hash1' },
        { hash: 'hash2' }
      ]);
      var _mirrorFind = sandbox.stub(
        bucketsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, [
              {
                toObject: (() => 'MIRROR'),
                isEstablished: true
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }
            ])
          };
        }
      });
      bucketsRouter.listMirrorsForFile(request, response, (err) => {
        _getBucketById.restore();
        _bucketEntryFindOne.restore();
        _pointerFind.restore();
        _mirrorFind.restore();
        expect(err.message).to.equal('Query failed');
        done();
      });
    });

    it('should error if it fails to find bucket entry', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/mirrors',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _getBucketById = sandbox.stub(
        bucketsRouter,
        '_getBucketById'
      ).callsArgWith(2, null, {
        id: 'bucketid'
      });
      var _bucketEntryFindOne = sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, null)
          };
        }
      });
      var _pointerFind = sandbox.stub(
        bucketsRouter.storage.models.Pointer,
        'find'
      ).callsArgWith(1, null, [
        { hash: 'hash1' },
        { hash: 'hash2' }
      ]);
      var _mirrorFind = sandbox.stub(
        bucketsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sandbox.stub().callsArgWith(0, null, [
              {
                toObject: (() => 'MIRROR'),
                isEstablished: true
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }, {
                toObject: (() => 'MIRROR'),
                isEstablished: false
              }
            ])
          };
        }
      });
      bucketsRouter.listMirrorsForFile(request, response, (err) => {
        _getBucketById.restore();
        _bucketEntryFindOne.restore();
        _pointerFind.restore();
        _mirrorFind.restore();
        expect(err.message).to.equal('File not found');
        done();
      });
    });

  });

  describe('#listFilesInBucket', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should internal error if bucket query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files',
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to lookup bucket'));
      bucketsRouter.listFilesInBucket(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Failed to lookup bucket');
        done();
      });
    });

    it('should not found error if bucket not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files',
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.listFilesInBucket(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should send back bucket entries', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files',
        params: {
          id: 'bucketid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var entries = [
        { frame: {} },
        { frame: {} },
        { frame: {} }
      ];
      var cursor = new ReadableStream({
        read: function() {
          this.push(entries.shift() || null);
        },
        objectMode: true
      });
      const find = {};
      find.populate = sandbox.stub().returns(find);
      find.limit = sandbox.stub().returns(find);
      find.cursor = sandbox.stub().returns(cursor);
      var _bucketEntryFind = sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'find'
      ).returns(find);
      response.on('end', function() {
        expect(find.limit.callCount).to.equal(1);
        expect(find.limit.args[0][0]).to.equal(2000);
        expect(_bucketFindOne.callCount).to.equal(1);
        expect(_bucketEntryFind.callCount).to.equal(1);
        done();
      });
      bucketsRouter.listFilesInBucket(request, response);
    });

    it('should send back bucket entries from startDate', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files',
        params: {
          id: 'bucketid'
        },
        query: {
          startDate: '1489615902401'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var bucket = new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      });
      var _bucketFindOne = sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var entries = [
        { frame: {} },
        { frame: {} },
        { frame: {} }
      ];
      var cursor = new ReadableStream({
        read: function() {
          this.push(entries.shift() || null);
        },
        objectMode: true
      });
      const find = {};
      find.populate = sandbox.stub().returns(find);
      find.limit = sandbox.stub().returns(find);
      find.cursor = sandbox.stub().returns(cursor);
      var _bucketEntryFind = sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'find'
      ).returns(find);
      response.on('end', function() {
        expect(find.limit.callCount).to.equal(1);
        expect(find.limit.args[0][0]).to.equal(2000);
        expect(_bucketFindOne.callCount).to.equal(1);
        expect(_bucketEntryFind.callCount).to.equal(1);
        expect(_bucketEntryFind.args[0][0]).to.eql({
          bucket: 'bucketid',
          created: { $gt: 1489615902401 }
        });
        done();
      });
      bucketsRouter.listFilesInBucket(request, response);
    });

  });

  describe('#removeFile', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should internal error if bucket query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to lookup bucket'));
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Failed to lookup bucket');
        done();
      });
    });

    it('should not found error if bucket not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should internal error if bucket entry not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, new Error('Failed to lookup bucket entry'))
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, null);
      var _storageEvent = sinon.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
        );
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
        _storageEvent.restore();
        expect(err.message).to.equal('Failed to lookup bucket entry');
        done();
      });
    });

    it('should not found error if bucket entry not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, null, null)
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, null);
      var _storageEvent = sinon.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
        );
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
        _storageEvent.restore();
        expect(err.message).to.equal('File not found');
        done();
      });
    });

    it('should internal error if deletion fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: sinon.stub().returns({
           exec: sinon.stub().callsArgWith(0, null, {
            remove: sinon.stub().callsArgWith(0, new Error('Failed to delete'))
          })
        })
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, null);
      var _storageEvent = sinon.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
        );
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
        _storageEvent.restore();
        expect(err.message).to.equal('Failed to delete');
        done();
      });
    });

    it('should return 204 on success', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, null, {
            frame: {
              size: 1000
            },
            remove: sinon.stub().callsArg(0)
          })
        })
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, null);
      var _storageEvent = sinon.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
        );
      response.on('end', function() {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
        _storageEvent.restore();
        expect(response.statusCode).to.equal(204);
        done();
      });
      bucketsRouter.removeFile(request, response);
    });

it('should throw error on storage event save failure', function(done) {
      sandbox.stub(log, 'warn');
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/buckets/:bucket_id/files/:file_id',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, {});
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: sinon.stub().returns({
          exec: sinon.stub().callsArgWith(0, null, {
            frame: {
              size: 1000
            },
            remove: sinon.stub().callsArg(0)
          })
        })
      });
      function StorageEvent() {}
      StorageEvent.prototype.save = sinon.stub().callsArgWith(0, new Error('test'));
      var _storageEvent = sinon.stub(
        bucketsRouter.storage.models,
        'StorageEvent',
        StorageEvent
        );
      response.on('end', function() {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
        _storageEvent.restore();
        expect(log.warn.callCount).to.equal(1);
        done();
      });
      bucketsRouter.removeFile(request, response);
    });

  });

  describe('#getFileId', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('should give internal error', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/file-ids/:name',
        params: {
          id: 'bucketid',
          name: 'base64encryptedfilename'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, new Error('Failed to get bucket'));
      bucketsRouter.getFileId(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        expect(err.message).to.equal('Failed to get bucket');
        done();
      });
    });

    it('should give notfound error', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/file-ids/:name',
        params: {
          id: 'bucketid',
          name: 'base64encryptedfilename'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, null, null);
      bucketsRouter.getFileId(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        expect(err.message).to.equal('Bucket not found');
        done();
      });
    });

    it('should give internal error', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/file-ids/:name',
        params: {
          id: 'bucketid',
          name: 'base64encryptedfilename'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, null, {});
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(3, new Error('test'));
      bucketsRouter.getFileId(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        expect(err.message).to.equal('test');
        done();
      });
    });

    it('should give notfound error', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/file-ids/:name',
        params: {
          id: 'bucketid',
          name: 'base64encryptedfilename'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, null, {});
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(3, null, null);
      bucketsRouter.getFileId(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        expect(err.message).to.equal('File not found');
        done();
      });
    });

    it('should give file id', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/file-ids/:name',
        params: {
          id: 'bucketid',
          name: 'base64encryptedfilename'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(3, null, {});
      sandbox.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).callsArgWith(3, null, { _id: '998960317b6725a3f8080c2b'});
      response.on('end', function() {
        expect(response.statusCode).to.equal(200);
        expect(response._getData().id).to.equal('998960317b6725a3f8080c2b');
        done();
      });
      bucketsRouter.getFileId(request, response, function(err) {
        if (err) {
          return done(err);
        }
      });
    });
  });

  describe('#getFileInfo', function() {

    it('should internal error if cannot get bucket', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/info',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _getBucketUnregistered = sinon.stub(
        bucketsRouter,
        '_getBucketUnregistered'
      ).callsArgWith(2, new Error('Failed to get bucket'));
      bucketsRouter.getFileInfo(request, response, function(err) {
        _getBucketUnregistered.restore();
        expect(err.message).to.equal('Failed to get bucket');
        done();
      });
    });

    it('should internal error if bucket entry query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/info',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _getBucketUnregistered = sinon.stub(
        bucketsRouter,
        '_getBucketUnregistered'
      ).callsArgWith(2, null, { _id: 'bucketid' });
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, new Error('Failed to get entry'))
      });
      bucketsRouter.getFileInfo(request, response, function(err) {
        _getBucketUnregistered.restore();
        _bucketEntryFindOne.restore();
        expect(err.message).to.equal('Failed to get entry');
        done();
      });
    });

    it('should not found error if bucket entry not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/info',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _getBucketUnregistered = sinon.stub(
        bucketsRouter,
        '_getBucketUnregistered'
      ).callsArgWith(2, null, { _id: 'bucketid' });
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, null, null)
      });
      bucketsRouter.getFileInfo(request, response, function(err) {
        _getBucketUnregistered.restore();
        _bucketEntryFindOne.restore();
        expect(err.message).to.equal('File not found');
        done();
      });
    });

    it('should send back bucket entry', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/buckets/:bucket_id/files/:file_id/info',
        params: {
          id: 'bucketid',
          file: 'fileid'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const index = '5bcfdacf38f0660efc7910abdc688cc0f7e4d285feb75c769ae8e41' +
            '4bfd4c386';
      var _getBucketUnregistered = sinon.stub(
        bucketsRouter,
        '_getBucketUnregistered'
      ).callsArgWith(2, null, { _id: 'bucketid' });
      var _bucketEntryFindOne = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'findOne'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, null, {
          bucket: 'bucketid',
          mimetype: 'application/json',
          filename: 'package.json',
          created: '2017-03-22T19:54:34.146Z',
          frame: 'frameid',
          size: 1024,
          id: 'fileid',
          hmac: {
            type: 'sha512',
            value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
              'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
              'b5e37e3f5c8'
          },
          erasure: {
            type: 'reedsolomon'
          },
          index: index
        })
      });
      response.on('end', function() {
        _getBucketUnregistered.restore();
        _bucketEntryFindOne.restore();
        expect(response._getData().created).to.equal('2017-03-22T19:54:34.146Z');
        expect(response._getData().filename).to.equal('package.json');
        expect(response._getData().erasure).to.eql({
          type: 'reedsolomon'
        });
        expect(response._getData().hmac).to.eql({
          type: 'sha512',
          value: 'f891be8e91491e4aeeb193e9e3afb49e83b6cc18df2be9732dd62545' +
            'ec5d318076ef86adc5771dc4b7b1ce8802bb3b9dce9f7c5a438afd1b1f52f' +
            'b5e37e3f5c8'
        });
        expect(response._getData().index).to.eql(index);
        done();
      });
      bucketsRouter.getFileInfo(request, response);
    });

  });

});
