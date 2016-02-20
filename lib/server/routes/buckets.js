/**
 * @module metadisk/routes/buckets
 */

'use strict';

const crypto = require('crypto');
const storj = require('storj');
const async = require('async');
const kad = require('storj/node_modules/kad');
const through = require('through');
const authenticate = require('../middleware').authenticate;
const tokenauth = require('../middleware').tokenauth;
const BusBoy = require('busboy');

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function BucketsRouterFactory(config, storage, network) {

  const Token = storage.models.Token;
  const File = storage.models.File;
  const Bucket = storage.models.Bucket;
  const verify = authenticate(storage);
  const usetoken = tokenauth(storage);

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

    if (req.pubkey && req.body.pubkeys.indexOf(req.pubkey._id) === -1) {
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
   * Creates a bucket operation token
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function createBucketToken(req, res, next) {
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

      let operation = req.body.operation;

      Token.create(bucket, operation, function(err, token) {
        if (err) {
          return next(err);
        }

        res.send(token.toObject());
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
    var token = req.token;

    Bucket.findOne({
      _id: req.params.id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      var tokenIsForBucket = token.bucket.toString() === bucket._id.toString();
      var tokenOperationIsValid = token.operation === 'PUSH';

      if (!tokenIsForBucket || !tokenOperationIsValid) {
        return next(new Error('Not authorized to retrieve from bucket'));
      }

      let file = new File({ bucket: bucket._id, shards: [] });
      let hash = crypto.createHash('sha256');

      let hasher = through(
        function onData(data) {
          hash.update(data);
          this.queue(data);
        },
        function onEnd() {
          file.hash = storj.utils.rmd160(hash.digest('hex'));
          this.queue(null);
        }
      );

      let chunkbuffer = through(
        function onData(data) {
          if (!this._buffer) {
            this._buffer = new Buffer([]);
          }

          this._buffer = Buffer.concat([this._buffer, data]);

          if (this._buffer.length >= (8 * 1024 * 1024)) {
            this.queue(this._buffer);
            delete this._buffer;
          }
        },
        function onEnd() {
          if (this._buffer.length) {
            this.queue(this._buffer);
          }

          this.queue(null);
        }
      );

      let transfer = through(
        function onData(chunk) {
          var self = this;

          // TODO: Make duration a request parameter
          self.pause();
          network.store(chunk/*.data*/, '10m', function(err, hash) {
            if (err) {
              return self.emit('error', err);
            }

            file.shards.push(hash);
            self.queue(hash);
            self.resume();
          });
        }
      );

      transfer.on('error', function onError(err) {
        next(err);
      });

      transfer.on('end', function onComplete() {
        File.findOne({ hash: file.hash }, function(err, pointer) {
          if (err) {
            return next(err);
          }

          if (pointer) {
            return res.send(file.toObject());
          }

          file.save(function(err) {
            if (err) {
              return next(err);
            }

            res.send(file.toObject());
          });
        });
      });

      let busboy = new BusBoy({ headers: req.headers });

      busboy.once('file', function(field, file/*, filename, encoding, mime*/) {
        file.pipe(chunkbuffer).pipe(hasher).pipe(transfer);
      });

      busboy.once('field', function(/*field, val, encoding, mimetype*/) {
        // TODO: Possibly store encoding and mimetype
      });

      req.pipe(busboy);
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
    var token = req.token;

    Bucket.findOne({
      _id: req.params.id
    }, function(err, bucket) {
      if (err) {
        return next(err);
      }

      if (!bucket) {
        return next(new Error('Bucket not found'));
      }

      var tokenIsForBucket = token.bucket.toString() === bucket._id.toString();
      var tokenOperationIsValid = token.operation === 'PULL';

      if (!tokenIsForBucket || !tokenOperationIsValid) {
        return next(new Error('Not authorized to retrieve from bucket'));
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

        async.mapSeries(file.shards, function(hash, done) {
          network._contracts.load(hash, function(err, contract) {
            if (err) {
              return done(err);
            }

            let farmer_id = contract.get('farmer_id');

            network._router.findNode(farmer_id, function(err, nodes) {
              if (err) {
                return done(err);
              }

              var farmer = nodes.filter(function(node) {
                return node.nodeID === contract.get('farmer_id');
              })[0];

              if (!farmer) {
                return done(new Error('Could not find the farmer'));
              }

              var message = new kad.Message({
                method: 'RETRIEVE',
                params: { data_hash: hash, contact: network._contact }
              });

              network._signMessage(message, function() {
                done(null, {
                  destination: farmer,
                  payload: message
                });
              });
            });
          });
        }, function(err, payloads) {
          if (err) {
            return next(err);
          }

          // Respond to client with an ordered list of payloads to send
          res.send(payloads);
        });
      });
    });
  }

  return [
    ['GET'    , '/buckets'            , verify   , getBuckets],
    ['GET'    , '/buckets/:id'        , verify   , getBucketById],
    ['POST'   , '/buckets'            , verify   , createBucket],
    ['DELETE' , '/buckets/:id'        , verify   , destroyBucketById],
    ['PATCH'  , '/buckets/:id'        , verify   , updateBucketById],
    ['POST'   , '/buckets/:id/tokens' , verify   , createBucketToken],
    ['PUT'    , '/buckets/:id'        , usetoken , storeFileInBucket],
    ['GET'    , '/buckets/:id/:hash'  , usetoken , getFileFromBucket]
  ];
}

module.exports = BucketsRouterFactory;
