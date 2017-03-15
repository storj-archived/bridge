'use strict';

const Router = require('./index');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all storage event related
 * information and queries 
 * @constructor
 * @extends {Router}
 */
function StorageEventRouter(options) {
  if (!(this instanceof StorageEventRouter)) {
    return new StorageEventRouter(options);
  }

  Router.apply(this, arguments);
}

inherits(StorageEventRouter, Router);

/**
 * Returns all storage events for a user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */

FramesRouter.prototype.getStorageEvents = function(req, res, next) {
  const StorageEvent = this.storage.models.StorageEvent;

  StorageEvent.find({
    bucketEntry: req.params.user._id
  }, function(err, storageEvents) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!storageEvent) {
      return next(new errors.NotFoundError('Storage Events not found'));
    }

    res.status(200).send(storageEvents.map(function(storageEvent) {
      return storageEvent.toObject();
  });
};

/**
 * Returns all storage events for a bucket
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.getStorageEventsByBucket = function(req, res, next) {
  const StorageEvent = this.storage.models.StorageEvent;

  StorageEvent.find({
    bucket: req.params.bucketid
  }, function(err, storageEvents) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!storageEvent) {
      return next(new errors.NotFoundError('Storage Events not found'));
    }

    res.status(200).send(storageEvents.map(function(storageEvent) {
      return storageEvent.toObject();
  });
};

/**
 * Returns all storage events for a bucket entry
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
FramesRouter.prototype.getStorageEventsByBucketEntry = function(req, res, next) {
  const StorageEvent = this.storage.models.StorageEvent;

  StorageEvent.find({
    bucketEntry: req.params.bucketentryid
  }, function(err, storageEvents) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!storageEvent) {
      return next(new errors.NotFoundError('Storage Events not found'));
    }

    res.status(200).send(storageEvents.map(function(storageEvent) {
      return storageEvent.toObject();
  });
};

/**
 * Export definitions
 * @private
 */
BucketsRouter.prototype._definitions = function() {
  /* jshint maxlen: 120 */
  return [
    ['GET', '/storage-events', this.getStorageEvents],
    ['GET', '/storage-events/:bucketid', this.getStorageEventsByBucket],
    ['GET', '/storage-events/:bucketentryid', this.getStorageEventsByBucketEntry],
  ];
};

module.exports = StorageEventRouter;
