/**
 * @module metadisk/routes/buckets
 */

'use strict';

const authenticate = require('../middleware').authenticate;

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function BucketsRouterFactory(storage, network) {

  const Bucket = storage.models.Bucket;
  const verify = authenticate(storage);

  /**
   * Returns a list of buckets for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getBuckets(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Returns the user's bucket by it's ID
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getBucketById(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Creates a new bucket for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function createBucket(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Destroys the user's bucket by ID
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function destroyBucketById(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Updates the given bucket's properties
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function updateBucketById(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Stores a file in the network tied to this bucket
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function storeFileInBucket(req, res, next) {
    next(new Error('Method not implemented'));
  }

  /**
   * Fetches the file from the network for this bucket
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getFileFromBucket(req, res, next) {
    next(new Error('Method not implemented'));
  }

  return [
    ['GET'    , '/buckets'           , verify , getBuckets],
    ['GET'    , '/buckets/:id'       , verify , getBucketById],
    ['POST'   , '/buckets'           , verify , createBucket],
    ['DELETE' , '/buckets/:id'       , verify , destroyBucketById],
    ['PATCH'  , '/buckets/:id'       , verify , updateBucketById],
    ['PUT'    , '/buckets/:id'       , verify , storeFileInBucket],
    ['GET'    , '/buckets/:id/:hash' , verify , getFileFromBucket]
  ];
}

module.exports = BucketsRouterFactory;
