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
const errors = require('../errors');

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function BucketsRouterFactory(config, storage, network) {

  const Token = storage.models.Token;
  const Contact = storage.models.Contact;
  const File = storage.models.File;
  const BucketEntry = storage.models.BucketEntry;
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
        return next(new errors.InternalError(err.message));
      }

      res.status(200).send(buckets.map(function(bucket) {
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
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      res.status(200).send(bucket.toObject());
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
        return next(new errors.InternalError(err.message));
      }

      res.status(200).send(bucket.toObject());
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
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      bucket.remove(function(err) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(204).end();
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
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      var allowed = ['storage', 'transfer', 'name', 'pubkeys'];

      for (let prop in req.body) {
        if (allowed.indexOf(prop) !== -1) {
          bucket[prop] = req.body[prop];
        }
      }

      bucket.save(function(err) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(200).send(bucket.toObject());
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
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      let operation = req.body.operation;

      Token.create(bucket, operation, function(err, token) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(200).send(token.toObject());
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
      return next(new errors.BadRequestError(
        'Missing or invalid x-filesize header sent'
      ));
    }

    Bucket.findOne({
      _id: req.params.id
    }, function(err, bucket) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      var tokenIsForBucket = token.bucket.toString() === bucket._id.toString();
      var tokenOperationIsValid = token.operation === 'PUSH';

      if (!tokenIsForBucket || !tokenOperationIsValid) {
        return next(new errors.NotAuthorizedError(
          'Not authorized to store in bucket'
        ));
      }

      let index = 0;
      let file = new File({
        size: 0
      });
      let entry = new BucketEntry({
        bucket: bucket._id
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
            this.emit('data', new Buffer(this._buffer));
            this._buffer = new Buffer([]);
          }
        },
        function onEnd() {
          if (this._buffer && this._buffer.length) {
            this.emit('data', new Buffer(this._buffer));
            this._buffer = new Buffer([]);
          }

          this.emit('end');
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
                new errors.BadRequestError('File size exceeds declared size')
              );
            }

            // Create a Hash object with the correct index
            hashes.push({
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
        if (file.size !== filesize) {
          return next(new errors.BadRequestError(
            'File does not match the declared size'
          ));
        }

        File.findOneAndUpdate({
          _id: file.hash
        }, file, {
          upsert: true,
          new: true
        }, function(err, pointer) {
          if (err) {
            return next(new errors.InternalError(err.message));
          }

          entry.file = pointer.id;

          BucketEntry.findOneAndUpdate({
            file: file.hash,
            bucket: bucket.id
          }, entry, {
            upsert: true,
            new: true
          }, function(err, bucketentry) {
            if (err) {
              return next(new errors.InternalError(err.message));
            }

            async.each(hashes, function(hash, done) {
              Hash.create(
                pointer,
                hash.hash,
                hash.index,
                done
              );
            }, function(err) {
              if (err) {
                return next(new errors.InternalError(err.message));
              }

              res.status(200).send({
                bucket: bucketentry.bucket,
                mimetype: bucketentry.mimetype,
                filename: bucketentry.filename,
                size: pointer.size,
                hash: pointer.hash
              });
            });
          });
        });
      });

      let busboy = new BusBoy({ headers: req.headers });

      busboy.once('file', function(field, stream, filename, encoding, mime) {
        entry.mimetype = mime;
        entry.name = filename;
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
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      var tokenIsForBucket = token.bucket.toString() === bucket._id.toString();
      var tokenOperationIsValid = token.operation === 'PULL';

      if (!tokenIsForBucket || !tokenOperationIsValid) {
        return next(new errors.NotAuthorizedError(
          'Not authorized to retrieve from bucket'
        ));
      }

      File.findOne({ _id: req.params.hash }, function(err, file) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        if (!file) {
          return next(new errors.NotFoundError(
            'The requested file was not found'
          ));
        }

        BucketEntry.findOne({
          file: file.id,
          bucket: bucket.id
        }, function(err, entry) {
          if (err) {
            return next(new errors.InternalError(err.message));
          }

          if (!entry) {
            return next(new errors.NotFoundError(
              'The requested file was not found'
            ));
          }

          Hash.find({
            file: entry.file
          }).sort({
            index: 1
          }).exec(function(err, shards) {
            if (err) {
              return next(new errors.InternalError(err.message));
            }

            async.mapSeries(shards, function(hash, done) {
              network._manager.load(hash._id, function(err, item) {
                if (err) {
                  return done(new errors.InternalError(err.message));
                }

                let contract;

                for (var c in item.contracts) {
                  if (item.contracts[c]._complete()) {
                    contract = item.contracts[c];
                  }
                }

                if (!contract) {
                  return done(new errors.NotFoundError(
                    'Failed to find the shard contract'
                  ));
                }

                let farmer_id = contract.get('farmer_id');

                Contact.findOne({ _id: farmer_id }, function(err, farmer) {
                  if (err) {
                    return done(new errors.InternalError(err.message));
                  }

                  if (!farmer) {
                    return done(new errors.NotFoundError(
                      'Could not find the farmer'
                    ));
                  }

                  var message = new kad.Message({
                    method: 'RETRIEVE',
                    params: { data_hash: hash._id, contact: network._contact }
                  });

                  network._transport.send(farmer, message, function(err, response) {
                    if (err) {
                      return done(new errors.InternalError(err.message));
                    }

                    if (response.error) {
                      return done(new errors.InternalError(
                        response.error.message
                      ));
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

              res.status(200).send(payloads);
            });
          });
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
        return next(new errors.InternalError(err.message));
      }

      if (!bucket) {
        return next(new errors.NotFoundError('Bucket not found'));
      }

      BucketEntry.find({
        bucket: req.params.id
      }).populate('file').exec(function(err, entries) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(200).send(entries.map(function(entry) {
          return {
            bucket: entry.bucket,
            mimetype: entry.mimetype,
            filename: entry.filename,
            size: entry.file.size,
            hash: entry.file.hash
          };
        }));
      });
    });
  }

  /**
   * Removes the file pointer from the bucket
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
   function removeFileFromBucket(req, res, next) {
     Bucket.findOne({
       _id: req.params.id,
       user: req.user._id
     }, function(err, bucket) {
       if (err) {
         return next(new errors.InternalError(err.message));
       }

       if (!bucket) {
         return next(new errors.NotFoundError('Bucket not found'));
       }

       BucketEntry.findOne({
         bucket: bucket._id,
         file: req.params.hash
       }, function(err, entry) {
         if (err) {
           return next(err);
         }

         if (!entry) {
           return next(new errors.NotFoundError('File not found'));
         }

         entry.remove(function(err) {
           if (err) {
             return next(new errors.InternalError(err.message));
           }

           res.status(204).end();
         });
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
    ['GET'    , '/buckets/:id/files/:hash'  , usetoken , getFileFromBucket],
    ['DELETE' , '/buckets/:id/files/:hash'  , verify   , removeFileFromBucket]
  ];
}

module.exports = BucketsRouterFactory;
