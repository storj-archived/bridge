'use strict';

const crypto = require('crypto');
const storj = require('storj');
const async = require('async');
const kad = require('storj/node_modules/kad');
const through = require('through');
const authenticate = require('../middleware').authenticate;
const tokenauth = require('../middleware').tokenauth;
const BusBoy = require('busboy');
const log = require('../../logger')();

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
  const Hash = storage.models.Hash;
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
    log.info('looking up buckets for %s', req.user._id);

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
    log.info('looking up bucket %s for %s', req.params.id, req.user._id);

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

    log.info('creating bucket for %s', req.user._id);

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
    log.info('removing bucket %s for %s', req.params.id, req.user._id);

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
    log.info('updating bucket %s for %s', req.params.id, req.user._id);

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
    log.info('creating %s token for %s', req.body.operation, req.user._id);

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
    log.info('storing file in bucket %s', req.params.id);

    var token = req.token;
    var filesize = Number(req.get('x-filesize'));
    var sizeIsValid = !Number.isNaN(filesize) && Number.isFinite(filesize);

    if (!sizeIsValid) {
      return next(new Error('Missing or invalid x-filesize header sent'));
    }

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
        return next(new Error('Not authorized to store in bucket'));
      }

      let index = 0;
      let file = new File({
        bucket: bucket._id,
        shards: [],
        size: 0
      });
      let hashes = [];
      let hash = crypto.createHash('sha256');

      let hasher = through(
        function onData(data) {
          hash.update(data);
          this.queue(data);
        },
        function onEnd() {
          file._id = storj.utils.rmd160(hash.digest('hex'));
          this.queue(null);
        }
      );

      let chunkbuffer = through(
        function onData(data) {
          if (!this._buffer) {
            this._buffer = new Buffer([]);
          }

          this._buffer = Buffer.concat([this._buffer, data]);

          // TODO: Smarter file chunker - bigger file, bigger chunk
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
          network.store(chunk, '10m', function(err, hash) {
            if (err) {
              return self.emit('error', err);
            }

            file.size = file.size + chunk.length;

            if (file.size > filesize) {
              return self.emit(
                'error',
                new Error('File size exceeds declared size')
              );
            }

            // Create a Hash object with the correct index
            hashes.push({
              file: file,
              hash: hash,
              index: index
            });

            index++;
            self.queue(hash);
            self.resume();
          });
        }
      );

      transfer.on('error', function onError(err) {
        next(err);
      });

      transfer.on('end', function onComplete() {
        var self = this;

        File.findOneAndUpdate({
          _id: file.hash,
          bucket: bucket._id
        }, file, {
          upsert: true,
          new: true
        }, function(err, pointer) {
          if (err) {
            return next(err);
          }

          async.each(hashes, function(hash, done) {
            Hash.create(
              hash.file,
              hash.hash,
              hash.index,
              done
            );
          }, function(err) {
            if (err) {
              return self.emit('error', err);
            }

            res.send(pointer.toObject());
          });
        });
      });

      let busboy = new BusBoy({ headers: req.headers });

      busboy.once('file', function(field, stream, filename, encoding, mime) {
        file.mimetype = mime;
        file.filename = filename;
        stream.pipe(chunkbuffer).pipe(hasher).pipe(transfer);
      });

      busboy.on('error', next);

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
    log.info('looking up file pointer for %s', req.params.hash);

    var token = req.token;

    // TODO: Increment download count in Shard meta

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

      Hash.find({
        file: req.params.hash
      }).sort({
        index: 1
      }).exec(function(err, shards) {
        if (err) {
          return next(err);
        }

        async.mapSeries(shards, function(hash, done) {
          network._manager.load(hash._id, function(err, item) {
            if (err) {
              return done(err);
            }

            // TODO: Perhaps we should make this smarter?
            let contract = item.contracts[Object.keys(item.contracts)[0]];
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
                params: { data_hash: hash._id, contact: network._contact }
              });

              network._transport.send(farmer, message, function(err, response) {
                if (err) {
                  return done(err);
                }

                if (response.error) {
                  return done(new Error(response.error.message));
                }

                done(null, {
                  hash: hash._id,
                  token: response.result.token,
                  operation: 'PULL',
                  channel: storj.DataChannelClient.getChannelURL(
                    response.result.contact
                  )
                });
              });
            });
          });
        }, function(err, payloads) {
          if (err) {
            return next(err);
          }

          res.send(payloads);
        });
      });
    });
  }

  /**
   * Lists the file pointers stored in the given bucket
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function listFilesInBucket(req, res, next) {
    log.info('looking up files stored in bucket %s', req.params.id);

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

      File.find({ bucket: req.params.id }, function(err, files) {
        if (err) {
          return next(err);
        }

        res.status(200).send(files.map(function(file) {
          return file.toObject();
        }));
      });
    });
  }

  return [
    ['GET'    , '/buckets'                  , verify   , getBuckets],
    ['GET'    , '/buckets/:id'              , verify   , getBucketById],
    ['POST'   , '/buckets'                  , verify   , createBucket],
    ['DELETE' , '/buckets/:id'              , verify   , destroyBucketById],
    ['PATCH'  , '/buckets/:id'              , verify   , updateBucketById],
    ['POST'   , '/buckets/:id/tokens'       , verify   , createBucketToken],
    ['PUT'    , '/buckets/:id/files'        , usetoken , storeFileInBucket],
    ['GET'    , '/buckets/:id/files'        , verify   , listFilesInBucket],
    ['GET'    , '/buckets/:id/files/:hash'  , usetoken , getFileFromBucket]
  ];
}

module.exports = BucketsRouterFactory;
