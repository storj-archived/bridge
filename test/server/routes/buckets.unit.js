'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const BucketsRouter = require('../../../lib/server/routes/buckets');

/* jshint maxstatements:false */
describe('BucketsRouter', function() {

  var bucketsRouter = new BucketsRouter(
    require('../../_fixtures/router-opts')
  );
  var someUser = new bucketsRouter.storage.models.User({
    _id: 'gordon@storj.io',
    hashpass: storj.utils.sha256('password')
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
      var _bucketFind = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'find'
      ).callsArgWith(1, new Error('Panic!'));
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
      var _bucketFind = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'find'
      ).callsArgWith(1, null, [
        new bucketsRouter.storage.models.Bucket({
          user: someUser._id
        })
      ]);
      response.on('end', function() {
        _bucketFind.restore();
        expect(response._getData()).to.have.lengthOf(1);
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

  describe('#createBucket', function() {

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
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, new Error('Failed to lookup bucket'));
      bucketsRouter.destroyBucketById(request, response, function(err) {
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
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, null);
      bucketsRouter.destroyBucketById(request, response, function(err) {
        _bucketFindOne.restore();
        expect(err.message).to.equal('Bucket not found');
        done();
      });
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
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArgWith(
        0,
        new Error('Failed to remove bucket')
      );
      bucketsRouter.destroyBucketById(request, response, function(err) {
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
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketRemove = sinon.stub(bucket, 'remove').callsArg(0);
      response.on('end', function() {
        _bucketFindOne.restore();
        _bucketRemove.restore();
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

    it.skip('should return internal error if query fails');

    it.skip('should return not found if no bucket');

    it.skip('should return the bucket if authenticated');

    it.skip('should return the bucket if it is public');

    it.skip('should return the bucket if the pubkey is authed');

    it.skip('should not authed error if not allowed');

  });

  describe('#createBucketToken', function() {

    it.skip('should error if bucket not accessible');

    it.skip('should internal error if token creation fails');

    it.skip('should send back token if success');

  });

  describe('#createEntryFromFrame', function() {

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
        lock: sinon.stub().callsArg(0)
      });
      var entry = { frame: 'frameid', bucket: 'bucketid' };
      var _bucketEntryCreate = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'create'
      ).callsArgWith(1, null, {
        toObject: sinon.stub().returns(entry)
      });
      response.on('end', function() {
        _bucketFindOne.restore();
        _frameFindOne.restore();
        _bucketEntryCreate.restore();
        expect(response._getData().frame).to.equal('frameid');
        expect(response._getData().bucket).to.equal('bucketid');
        done();
      });
      bucketsRouter.createEntryFromFrame(request, response);
    });

  });

  describe('#_getBucketById', function() {

    it.skip('should filter by user id if supplied');

    it.skip('should internal error if query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should return bucket');

  });

  describe('#getBucketEntryById', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if entry not found');

    it.skip('should return the bucket entry');

  });

  describe('#getPointersForEntry', function() {

    it.skip('should internal error if query fails');

    it.skip('should return pointers');

  });

  describe('#getMirrorsForPointers', function() {

    it.skip('should return a mirror map from pointers');

  });

  describe('#getContactById', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if contact not found');

    it.skip('should return the contact');

  });

  describe('#getMirrorAuthorization', function() {

    it.skip('should internal error if cannot load contract');

    it.skip('should internal error if contacts cannot load');

    it.skip('should internal error if cannot get pointer');

    it.skip('should return mirro authorization');

  });

  describe('#getMirroringTokens', function() {

    it.skip('should get mirror authorizations for each token');

  });

  describe('#createMirrorsFromTokenMap', function() {

    it.skip('should internal error if canno load contract');

    it.skip('should internal error if mirror fails to save');

    it.skip('should internal error if contract canno save');

    it.skip('should mirror the data to the mirrors in the map');

  });

  describe('#replicateFile', function() {

    it.skip('should bad request error if no file supplied');

    it.skip('should bad request error if invalid mirrors supplied');

    it.skip('should internal error if waterfall fails at any point');

    it.skip('should send back mirror contacts for shards');

  });

  describe('#_getRetrievalToken', function() {

    it.skip('should internal error if contract cannot load');

    it.skip('should internal error if no token retrieved');

    it.skip('should callback with pointer when received');

  });

  describe('#_requestRetrievalPointer', function() {

    it.skip('should callback empty if query fails');

    it.skip('should callback empty if no contact returned');

    it.skip('should callback empty if cannot get pointer');

    it.skip('should callback empty if response has no token');

    it.skip('should add download count to item if not there');

    it.skip('should set download count to 1 if not exists');

    it.skip('should internal error if cannot save contract');

    it.skip('should callback with pointer');

  });

  describe('#_getPointersFromEntry', function() {

    it.skip('should internal error if query fails');

    it.skip('should internal error if any retreive token fails');

    it.skip('should callback with results');

  });

  describe('#getFile', function() {

    it.skip('should not authorized error if token is invalid');

    it.skip('should internal error if bucket query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should internal error if bucket entry query fails');

    it.skip('should not found error if bucket entry not found');

    it.skip('should internal error if fails to get pointers');

    it.skip('should send retrieval pointers');

  });

  describe('#listFilesInBucket', function() {

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

    it('should internal error if bucket entry query fails', function(done) {
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
      ).callsArgWith(1, null, new bucketsRouter.storage.models.Bucket({
        user: someUser._id
      }));
      var _bucketEntryFind = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'find'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(0, new Error('Failed to lookup entry'))
      });
      bucketsRouter.listFilesInBucket(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFind.restore();
        expect(err.message).to.equal('Failed to lookup entry');
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
      var _bucketFindOne = sinon.stub(
        bucketsRouter.storage.models.Bucket,
        'findOne'
      ).callsArgWith(1, null, bucket);
      var _bucketEntryFind = sinon.stub(
        bucketsRouter.storage.models.BucketEntry,
        'find'
      ).returns({
        populate: function() {
          return this;
        },
        exec: sinon.stub().callsArgWith(
          0,
          null,
          [{ frame: {} }]
        )
      });
      response.on('end', function() {
        _bucketFindOne.restore();
        _bucketEntryFind.restore();
        expect(response._getData()).to.have.lengthOf(1);
        done();
      });
      bucketsRouter.listFilesInBucket(request, response);
    });

  });

  describe('#removeFile', function() {

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
      ).callsArgWith(1, new Error('Failed to lookup bucket entry'));
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
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
      ).callsArgWith(1, null, null);
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
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
      ).callsArgWith(1, null, {
        remove: sinon.stub().callsArgWith(0, new Error('Failed to delete'))
      });
      bucketsRouter.removeFile(request, response, function(err) {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
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
      ).callsArgWith(1, null, {
        remove: sinon.stub().callsArg(0)
      });
      response.on('end', function() {
        _bucketFindOne.restore();
        _bucketEntryFindOne.restore();
        expect(response.statusCode).to.equal(204);
        done();
      });
      bucketsRouter.removeFile(request, response);
    });

  });

  describe('#getFileInfo', function() {

    it.skip('should internal error if cannot get bucket');

    it.skip('should internal error if bucket entry query fails');

    it.skip('should not found error if bucket entry not found');

    it.skip('should send back bucket entry');

  });

});
