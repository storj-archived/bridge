/* jshint unused:false */ // TODO: REMOVE ME

'use strict';

const expect = require('chai').expect;
const BucketsRouter = require('../../../lib/server/routes/buckets');

describe('BucketsRouter', function() {

  describe('#getBuckets', function() {

    it.skip('should internal error if query fails');

    it.skip('should return buckets');

  });

  describe('#getBucketById', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if no bucket');

    it.skip('should return bucket if found');

  });

  describe('#createBucket', function() {

    it.skip('should bad request error if invalid pubkey given');

    it.skip('should internal error if creation fails');

    it.skip('should return the created bucket');

  });

  describe('#destroyBucketById', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if no bucket');

    it.skip('should internal error if deletion fails');

    it.skip('should return 204 on success');

  });

  describe('#updateBucketById', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should bad request error if invalid pubkey');

    it.skip('should internal error if save fails');

    it.skip('should return bucket if success');

  });

  describe('#createBucketToken', function() {

    it.skip('should not authorized error if authorize fails');

    it.skip('should internal error if bucket query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should internal error if token creation fails');

    it.skip('should send back token if success');

  });

  describe('#createEntryFromFrame', function() {

    it.skip('should internal error if bucket query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should bad request error if frame is locked');

    it.skip('should internal error if bucket entry creation fails');

    it.skip('should internal error if frame lock fails');

    it.skip('should send back bucket entry if success');

  });

  describe('#replicateFile', function() {

    it.skip('should bad request error if no file supplied');

    it.skip('should bad request error if invalid mirrors supplied');

    it.skip('should internal error if bucket lookup fails');

    it.skip('should not found error if bucket not found');

    it.skip('should internal error if bucket entry lookup fails');

    it.skip('should not found error if bucket entry not found');

    it.skip('should internal error if pointer lookup fails');

    it.skip('should internal error if mirrors lookup fails');

    it.skip('should internal error if cannon load contract');

    it.skip('should internal error if contact lookup fails');

    it.skip('should not found error if contact no found');

    it.skip('should internal error if retrieval pointer fails');

    it.skip('should internal error if mirron contact query fails');

    it.skip('should not found error if mirror contact lookup fails');

    it.skip('should return early if no mirrors found');

    it.skip('should internal error if contract cannot be loaded for mirror');

    it.skip('should internal error if contract cannot be updated');

    it.skip('should send back mirror contacts for shards');

  });

  describe('#getFile', function() {

    it.skip('should not authorized error if token is invalid');

    it.skip('should internal error if bucket not found');

    it.skip('should not found error if bucket not found');

    it.skip('should internal error if bucket entry query fails');

    it.skip('should not found error if bucket entry not found');

    it.skip('should internal error if pointer query fails');

    it.skip('should internal error if retrieval token fails');

    it.skip('should error if retrieval token contract cannot load');

    it.skip('should error if no farmers gave a token back');

    it.skip('should send retrieval pointers');

  });

  describe('#listFilesInBucket', function() {

    it.skip('should internal error if bucket query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should internal error if bucket entry query fails');

    it.skip('should send back bucket entries');

  });

  describe('#removeFile', function() {

    it.skip('should internal error if bucket query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should internal error if bucket entry not found');

    it.skip('should not found error if bucket entry not found');

    it.skip('should internal error if deletion fails');

    it.skip('should return 204 on success');

  });

  describe('#getFileInfo', function() {

    it.skip('should internal error if bucket query fails');

    it.skip('should not found error if bucket not found');

    it.skip('should not authorized error if not allowed');

    it.skip('should internal error if bucket entry query fails');

    it.skip('should not found error if bucket entry not found');

    it.skip('should send back bucket entry');

  });

});
