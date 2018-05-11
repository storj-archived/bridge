#!/usr/bin/env node
'use strict';

// usage: cat data-to-backup.tsv | node storj-dl-tool.js -o /tmp/storj -c /path/to/config.json

const fs = require('fs');
const http = require('http');
const async = require('async');
const crypto = require('crypto');
const Config = require('../lib/config');
const program = require('commander');
const storj = require('storj-lib');
const Storage = require('storj-service-storage-models');
const complex = require('storj-complex');
const mkdirp = require('mkdirp');
const path = require('path');
const through2 = require('through2');
const levelup = require('levelup');
const leveldown = require('leveldown');
const logger = require('../lib/logger');
const readline = require('readline');
const assert = require('assert');
const {Transform} = require('stream');

// SHARD STATUS ERROR STATUS
const ERROR_SIZE = 6;
const ERROR_STREAM = 5;
const ERROR_HASH = 4;
const ERROR_TOKEN = 3;
const ERROR_CONTRACT = 2;
const ERROR_CONTACT = 1;
const SUCCESS = 0;

// CSV SETTINGS
let firstLine = true;

// CONCURRENCY LIMITS
const CONTACT_CONCURRENCY = 100;

// CONCURRENCY TRACKING
let contactCount = 0;
let concurrentShards = 0;
let contactFinished = 0;
let shardFinished = 0;

// OTHER SETTINGS
const SHARD_SOCKET_TIMEOUT = 90 * 1000 // milliseconds
const SHARD_TRANSFER_MAXTIME = 20 * 60 * 1000 // milliseconds

program
  .version('0.0.1')
  .option('-c, --config <path_to_config_file>', 'path to the config file')
  .option('-o, --outputdir <path_to_outputdir>', 'path to where shards are saved')
  .parse(process.argv);

// READ STDIN FOR THE CSV
process.stdin.setEncoding('utf8');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// SETUP DB AND NETWORK
const config = new Config(process.env.NODE_ENV || 'develop', program.config,
                          program.datadir);
const network = complex.createClient(config.complex);
const { mongoUrl, mongoOpts } = config.storage;
const storage = new Storage(mongoUrl, mongoOpts, { logger });

const DOWNLOAD_DIR = program.outputdir;
assert(path.isAbsolute(DOWNLOAD_DIR), 'outputdir is expected to be absolute path');

const db = levelup(leveldown(path.resolve(DOWNLOAD_DIR, 'statedb')));

// LOGGING OF CONCURRENCY
const statusInterval = setInterval(() => {
  let totalShards = 0;
  logger.info('status: contactCount: %d, totalShards: %d, contactFinished: %s, ' +
              'shardFinished: %s, memory: %j',
              contactCount, concurrentShards, contactFinished, shardFinished,
              process.memoryUsage());

}, 5 * 1000);

// HELPER FUNCTIONS
function sanitizeNodeID(a) {
  return a.replace(/'/g, ''); //'
}

function dbKey(shardHash) {
  return Buffer.from(shardHash, 'hex')
}

function closeProgram() {
  storage.connection.close();
  clearInterval(statusInterval);
  db.close();
}

function getDirectoryPath(shardHash) {
  // creating two directories based on first two bytes
  return path.resolve(DOWNLOAD_DIR, shardHash.slice(0, 2), shardHash.slice(2, 4))
}

let streamEnded = false;
const stream = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    if (firstLine) {
      firstLine = false;
      callback();
    } else {
      const items = chunk.split('\t').map(x => x.trim());
      callback(null, {
        shardHash: items[2],
        nodeID: items[3],
        contractSize: parseInt(items[4])
      });
    }
  }
});

rl.on('close', () => {
  stream.end();
  logger.info('ended reading input of node ids');
});

rl.on('line', (line) => stream.write(line));

stream.on('error', (err) => console.error('error', err));

stream.on('end', () => streamEnded = true);

stream.on('data', function(line) {

  // expand line to local variables
  const {shardHash, nodeID, contractSize} = line;

  contactCount++;
  logger.info('starting on a shard: %s, node: %s, contractSize: %d',
              shardHash, nodeID, contractSize);

  if (contactCount > CONTACT_CONCURRENCY) {
    stream.pause();
  };

  function contactFinish(err) {
    contactCount--;
    contactFinished++;
    logger.info('finished work on contact %s, running count: %d, paused: %s',
                nodeID, contactCount, stream.isPaused());
    if (err) {
      logger.error(err.message);
    }
    if (streamEnded && contactCount == 0) {
      // THE END all contacts finished
      logger.info('done! finished running all contacts');
      closeProgram();
    } else if (stream.isPaused() && contactCount <= CONTACT_CONCURRENCY) {
      stream.resume();
    }
  };

  const shardResults = {};
  async.series([
    (next) => {
      db.get(dbKey(shardHash), function (err) {
        if (err && err.notFound) {
          next();
        } else if (err) {
          next(err);
        } else {
          next(new Error('already checked'));
        }
      });
    },
    (next) => {
      storage.models.Shard.findOne({
        'contracts.nodeID': nodeID,
        'contracts.contract.store_end': {
          $gte: Date.now()
        },
        'hash': shardHash
      }, function(err, shard) {
        if (err) {
          logger.error('cursor error for contact %s', err.message);
          next(err);
          return;
        }
        if (!shard) {
          next(new Error('shard not found'));
          return;
        }

        concurrentShards += 1;

        logger.info('contact %s shard %s started, running shards: %d',
                    nodeID, shard.hash, concurrentShards)

        let shardFinishedCalled = false;
        let shardTransferTimeout = null;

        function shardFinish(err) {
          // prevent double callback
          if (shardFinishedCalled) {
            return;
          }
          shardFinishedCalled = true;
          // make sure that the timeout callback isn't called
          clearTimeout(shardTransferTimeout);
          concurrentShards -= 1;
          shardFinished++;
          logger.info('contact %s shard %s finished, running shards: %d',
                      nodeID, shard.hash, concurrentShards)
          if (err) {
            logger.error(err.message);
          }
          next(err);
        };

        storage.models.Contact.findOne({ '_id': nodeID }, function (err, contact) {
          if (err) {
            return shardFinish(err);
          }
          if (!contact) {
            shardResults[sanitizeNodeID(shard.hash)] = {
              status: ERROR_CONTACT,
              contract: null
            }
            return shardFinish(new Error('contact not found: ' + nodeID));
          }

          // creating instance of storj.Contact and storj.Contract
          contact = storj.Contact(contact);
          const contractData = shard.contracts.filter((contract) => {
            return contract.nodeID == nodeID;
          })[0];

          if (!contractData || !contractData.contract) {
            logger.error('contract not found node %s shard %s', nodeID, shard.hash);
            shardResults[sanitizeNodeID(shard.hash)] = {
              status: ERROR_CONTRACT,
              contract: null
            }
            return shardFinish(new Error('contract not found'));
          }

          const contract = storj.Contract.fromObject(contractData.contract);

          network.getRetrievalPointer(contact, contract, function (err, pointer) {
            if (err || !pointer || !pointer.token) {
              logger.warn('no token for node %s shard %s', contact, shard.hash);
              shardResults[sanitizeNodeID(shard.hash)] = {
                status: ERROR_TOKEN,
                contract: contract.toObject()
              }
              return shardFinish(new Error('no token for node ' + contact +
                    ' shard ' + shard.hash));
            }

            const filedir = getDirectoryPath(shard.hash);

            mkdirp(filedir, function (err) {
              if (err) {
                return shardFinish(err);
              }
              logger.debug('creating open file for shard %s', shard.hash);

              const file = fs.createWriteStream(path.resolve(filedir, shard.hash));
              file.on('close', function () {
                logger.debug('file closed for shard %s', shard.hash);
              });

              logger.info('starting to download shard %s with token %s for contact %s',
                          shard.hash, pointer.token, nodeID)

              const hasher = crypto.createHash('sha256');
              var size = 0;

              const shardRequest = http.get({
                protocol: 'http:',
                hostname: contact.address,
                port: contact.port,
                path: `/shards/${shard.hash}?token=${pointer.token}`,
                timeout: SHARD_SOCKET_TIMEOUT,
                headers: {
                  'content-type': 'application/octet-stream',
                  'x-storj-node-id': contact.nodeID
                }
              }, (res) => {

                const statusCode = res.statusCode;
                const contentType = res.headers['content-type'];

                let error;
                if (statusCode !== 200) {
                  error = new Error('unexpected status code: ' + statusCode);
                } else if (!/^application\/octet\-stream/.test(contentType)) {
                  error = new Error('unexpected content type: ' + contentType);
                }

                if (error) {
                  // consume response data to free up memory
                  // https://nodejs.org/docs/v6.9.5/doc/api/http.html#http_http_get_options_callback
                  res.resume();

                  shardResults[sanitizeNodeID(shard.hash)] = {
                    status: ERROR_STREAM,
                    contract: null
                  };
                  return shardFinish(error);
                }

                res.on('data', (chunk) => {
                  size += chunk.length;
                  hasher.update(chunk);
                  file.write(chunk);
                });

                res.on('end', () => {
                  const actual = storj.utils.rmd160b(hasher.digest()).toString('hex');
                  if (actual !== shard.hash) {
                    shardResults[sanitizeNodeID(shard.hash)] = {
                      status: ERROR_HASH,
                      contract: contract.toObject()
                    }
                    logger.info('shard %s failed to download, actual: %s', shard.hash, actual);
                    shardFinish(new Error('unexpected data'))
                  } else if (size !== contract.get('data_size') || size !== contractSize) {
                    shardResults[sanitizeNodeID(shard.hash)] = {
                      status: ERROR_SIZE,
                      contract: contract.toObject()
                    }
                    logger.info('shard %s wrong size, actual: %s', contract.get('data_size'), size);
                    shardFinish(new Error('unexpected size'))
                  } else {
                    shardResults[sanitizeNodeID(shard.hash)] = {
                      status: SUCCESS,
                      contract: contract.toObject()
                    };
                    logger.info('shard %s successfully downloaded', shard.hash);
                    shardFinish();
                  }
                });

              }).on('error', (err) => {
                shardResults[sanitizeNodeID(shard.hash)] = {
                  status: ERROR_STREAM,
                  contract: contract.toObject()
                };
                shardFinish(err);
              });

              shardTransferTimeout = setTimeout(() => {
                // https://nodejs.org/docs/latest-v6.x/api/http.html#http_request_abort
                // this will fire the res end event for the request and request error
                shardRequest.abort();
              }, SHARD_TRANSFER_MAXTIME);
            })
          });
        });
      });
    },
    (next) => {
      logger.info('saving state for node %s', nodeID);
      db.put(dbKey(shardHash), JSON.stringify(shardResults), (err) => {
        if (err) {
          return next(err);
        }
        logger.info('saved state for %s', nodeID);
        next();
      });
    }
  ], contactFinish)
});
