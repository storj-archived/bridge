e strict';

// usage: cat contacts.csv | node storj-audit-tool.js -o /tmp/storj -c /path/to/config.json

const fs = require('fs');
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
const ERROR_STREAM = 5;
const ERROR_HASH = 4;
const ERROR_TOKEN = 3;
const ERROR_CONTRACT = 2;
const ERROR_CONTACT = 1;
const SUCCESS = 0;

// AUDIT SETTINGS
const AUDIT_SAMPLE_RATIO = 0.02;
const AUDIT_SAMPLE_MIN = 10;
const AUDIT_SAMPLE_MAX = 50;

// CSV SETTINGS
let firstLine = true;
const nodeIDColumnIndex = 0;
const contractsColumnIndex = 6;

// CONCURRENCY LIMITS
const SHARD_CONCURRENCY = 10;
const CONTACT_CONCURRENCY = 20;

// CONCURRENCY TRACKING
let contactCount = 0;
let shardCount = {};
let contactFinished = 0;
let shardFinished = 0;

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
  for (var key in shardCount) {
    totalShards += shardCount[key];
  }
  logger.info('status: contactCount: %d, totalShards: %d, contactFinished: %s, ' +
              'shardFinished: %s, memory: %j',
              contactCount, totalShards, contactFinished, shardFinished, process.memoryUsage());

}, 5 * 1000);

// HELPER FUNCTIONS
function sanitizeNodeID(a) {
  return a.replace(/'/g, '');
}

function toHexBuffer(a) {
  return Buffer.from(a, 'hex')
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
      const items = chunk.split(',').map(x => x.trim());
      const totalContracts = parseInt(items[contractsColumnIndex]);
      const size = Math.round(AUDIT_SAMPLE_RATIO * totalContracts, 0);
      const limit = Math.min(Math.max(size, AUDIT_SAMPLE_MIN), AUDIT_SAMPLE_MAX)
      const contractLimit = Number.isInteger(limit) ? limit : AUDIT_SAMPLE_MIN;
      callback(null, {
        nodeID: items[nodeIDColumnIndex],
        totalContracts: totalContracts,
        contractLimit: contractLimit
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
  const {nodeID, totalContracts, contractLimit} = line;

  contactCount++;
  logger.info('starting on a contact: %s, contractLimit: %s, running count: %d',
              nodeID, contractLimit, contactCount);

  if (contactCount >= CONTACT_CONCURRENCY) {
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
    } else if (stream.isPaused() && contactCount < CONTACT_CONCURRENCY) {
      stream.resume();
    }
  };

  const shardResults = {};
  async.series([
    (next) => {
      db.get(toHexBuffer(nodeID), function (err) {
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
      const cursor = storage.models.Shard.find({
        'contracts.nodeID': nodeID,
        'contracts.contract.store_end': {
          $gte: Date.now()
        },
        'hash': {
          // querying mongo for a shard hash greater than (but close to)
          // random generated crypto value
          $gte: crypto.randomBytes(20).toString('hex')
        }
      }).limit(contractLimit).cursor();

      shardCount[nodeID] = 0;
      let shardCursorEnded = false;

      cursor.on('error', (err) => {
        logger.error('cursor error for contact %s', err.message);
        next(err);
      });

      cursor.on('end', () => {
        shardCursorEnded = true;
        if (shardCount[nodeID] == 0) {
          // THE END there were no shards
          next();
        }
      });

      cursor.on('data', function (shard) {
        shardCount[nodeID]++;
        logger.info('contact %s shard %s started, running shards: %d',
                    nodeID, shard.hash, shardCount[nodeID])
        if (shardCount[nodeID] >= SHARD_CONCURRENCY) {
          cursor.pause();
        };

        function finish(err) {
          shardCount[nodeID]--;
          shardFinished++;
          logger.info('contact %s shard %s finished, running shards: %d',
                      nodeID, shard.hash, shardCount[nodeID])
          if (err) {
            logger.error(err.message);
          }
          if (shardCount[nodeID] === 0 && shardCursorEnded) {
            // THE END all shards have been downloaded
            logger.info('all shards downloaded for contact %s', nodeID)
            next();
          } else if (shardCount[nodeID] < SHARD_CONCURRENCY) {
            cursor.resume();
          }
        };

        storage.models.Contact.findOne({ '_id': nodeID }, function (err, contact) {
          if (err) {
            return finish(err);
          }
          if (!contact) {
            shardResults[sanitizeNodeID(shard.hash)] = {
              status: ERROR_CONTACT,
              contract: null
            }
            return finish(new Error('contact not found: ' + nodeID));
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
            return finish(new Error('contract not found'));
          }

          const contract = storj.Contract.fromObject(contractData.contract);

          network.getRetrievalPointer(contact, contract, function (err, pointer) {
            if (err || !pointer || !pointer.token) {
              logger.warn('no token for node %s shard %s', contact, shard.hash);
              shardResults[sanitizeNodeID(shard.hash)] = {
                status: ERROR_TOKEN,
                contract: contract.toObject()
              }
              return finish();
            }

            const filedir = getDirectoryPath(shard.hash);

            mkdirp(filedir, function (err) {
              if (err) {
                return finish(err);
              }
              logger.debug('creating open file for shard %s', shard.hash);
              const file = fs.createWriteStream(path.resolve(filedir, shard.hash));
              file.on('close', function () {
                logger.debug('file closed for shard %s', shard.hash);
              });

              const hash = crypto.createHash('sha256');
              const hasher = through2(function (data, enc, callback) {
                hash.update(data);
                this.push(data);
                callback()
              });

              // piping to hasher then to file as shard data is downloaded
              logger.info('starting to download shard %s with token %s for contact %s',
                          shard.hash, pointer.token, nodeID)
              const shardStream = storj.utils.createShardDownloader(
                contact, shard.hash, pointer.token).pipe(hasher).pipe(file);

              shardStream.on('close', function () {
                const actual = storj.utils.rmd160b(hash.digest()).toString('hex');
                if (actual == shard.hash) {
                  shardResults[sanitizeNodeID(shard.hash)] = {
                    status: SUCCESS,
                    contract: contract.toObject()
                  };
                  logger.info('shard %s successfully downloaded', shard.hash);
                } else {
                  shardResults[sanitizeNodeID(shard.hash)] = {
                    status: ERROR_HASH,
                    contract: contract.toObject()
                  }
                  logger.info('shard %s failed to download, actual: %s', shard.hash, actual);
                }
                finish();
              });

              shardStream.on('error', (err) => {
                shardResults[sanitizeNodeID(shard.hash)] = {
                  status: ERROR_STREAM,
                  contract: contact.toObject()
                };
                finish(err);
              });
            })

          });
        });
      });
    },
    (next) => {
      logger.info('saving state for node %s', nodeID);
      db.put(toHexBuffer(nodeID), JSON.stringify(shardResults), (err) => {
        if (err) {
          return next(err);
        }
        logger.info('saved state for %s', nodeID);
        next();
      });
    }
  ], contactFinish)
});
