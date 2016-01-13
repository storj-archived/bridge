/**
 * @module metadisk/routes/buckets
 */

'use strict';

const crypto = require('crypto');
const through = require('through');
const authenticate = require('../middleware').authenticate;

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function BucketsRouterFactory(storage, network) {

  const File = storage.models.File;
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
    Bucket.find({ user: req.user._id }, function(err, buckets) {
      if (err) {
        return next(err);
      }

      res.send(buckets.map(function(bucket) {
        return bucket.toObject();
      }));
    });
  }

  /**
   * Returns the user's bucket by it's ID
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getBucketById(req, res, next) {
    Bucket.findOne({
      _id: req.params.id,
      user: req.user._id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      res.send(bucket.toObject());
    });
  }

  /**
   * Creates a new bucket for the user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function createBucket(req, res, next) {
    if (!Array.isArray(req.body.pubkeys)) {
      req.body.pubkeys = [];
    }

    if (req.body.pubkeys.indexOf(req.pubkey._id) === -1) {
      req.body.pubkeys.push(req.pubkey._id);
    }

    Bucket.create(req.user, req.body, function(err, bucket) {
      if (err) {
        return next(err);
      }

      res.send(bucket.toObject());
    });
  }

  /**
   * Destroys the user's bucket by ID
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function destroyBucketById(req, res, next) {
    Bucket.findOne({
      _id: req.params.id,
      user: req.user._id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      bucket.remove(function(err) {
        if (err) {
          return next(err);
        }

        res.status(200).end();
      });
    });
  }

  /**
   * Updates the given bucket's properties
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function updateBucketById(req, res, next) {
    Bucket.findOne({
      _id: req.params.id,
      user: req.user._id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      var allowed = ['storage', 'transfer', 'name', 'pubkeys'];

      for (let prop in req.body) {
        if (allowed.indexOf(prop) !== -1) {
          bucket[prop] = req.body[prop];
        }
      }

      bucket.save(function(err) {
        if (err) {
          return next(err);
        }

        res.send(bucket.toObject());
      });
    });
  }

  /**
   * Stores a file in the network tied to this bucket
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function storeFileInBucket(req, res, next) {
    Bucket.findOne({
      _id: req.params.id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      if (bucket.pubkeys.indexOf(req.pubkey._id) === -1) {
        return next(new Error('Not authorized to store in bucket'));
      }

      let file = new File({ bucket: bucket._id });
      let hash = crypto.createHash('sha256');

      let hasher = through(
        function onData(data) {
          hash.update(data);
          this.queue(data);
        },
        function onEnd() {
          file.hash = hash.digest('hex');
        }
      );

      let stream = req.pipe(hasher).pipe(network.createTransferStream());

      stream.on('data', function onStore(hash) {
        file.shards.push(hash);
      });

      stream.on('error', function onError(err) {
        next(err);
      });

      stream.on('end', function onComplete() {
        file.save(function(err) {
          if (err) {
            return next(err);
          }

          res.send(file.toObject());
        });
      });
    });
  }

  /**
   * Fetches the file from the network for this bucket
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function getFileFromBucket(req, res, next) {
    Bucket.findOne({
      _id: req.params.id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      if (bucket.pubkeys.indexOf(req.pubkey._id) === -1) {
        return next(new Error('Not authorized to store in bucket'));
      }

      File.findOne({
        bucket: bucket._id,
        hash: req.params.hash
      }, function(err, file) {
        if (err) {
          return next(err);
        }

        if (!file) {
          return next(new Error('File pointer not found'));
        }

        network.createReadStream(file).pipe(res);
      });
    });
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
