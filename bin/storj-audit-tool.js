#!/usr/bin/env node
'use strict';

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

// SHARD STATUS ERROR STATUS
const ERROR_STREAM = 5;
const ERROR_HASH = 4;
const ERROR_TOKEN = 3;
const ERROR_CONTRACT = 2;
const ERROR_CONTACT = 1;
const SUCCESS = 0;

program
  .version('0.0.1')
  .option('-c, --config <path_to_config_file>', 'path to the config file')
  .option('-o, --outputdir <path_to_outputdir>', 'path to where shards are saved')
  .parse(process.argv);

process.stdin.setEncoding('utf8');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const config = new Config(process.env.NODE_ENV || 'develop', program.config,
  program.datadir);
const network = complex.createClient(config.complex);
const { mongoUrl, mongoOpts } = config.storage;
const storage = new Storage(mongoUrl, mongoOpts, { logger });

const SHARD_CONCURRENCY = 10;
const CONTACT_CONCURRENCY = 10;

const DOWNLOAD_DIR = program.outputdir;
assert(path.isAbsolute(DOWNLOAD_DIR), 'outputdir is expected to be absolute path');

const db = levelup(leveldown(path.resolve(DOWNLOAD_DIR, 'statedb')));

function sanitizeNodeID(a) {
  return a.replace(/'/g, '');
}

function toHexBuffer(a) {
  return Buffer.from(a, 'hex')
}

function closeProgram() {
  storage.connection.close();
  db.close();
}

function getDirectoryPath(shardHash) {
  // creating two directories based on first two bytes
  return path.resolve(DOWNLOAD_DIR, shardHash.slice(0, 2), shardHash.slice(2, 4))
}

rl.on('close', function () {
  logger.info('ended reading input of node ids');
});

let contactCount = 0;
rl.on('line', function (nodeID) {
  contactCount++;
  logger.info('starting on a contact: %s, running count: %d', nodeID, contactCount);
  if (contactCount >= CONTACT_CONCURRENCY) {
    rl.pause();
  };
  function contactFinish(err) {
    contactCount--;
    logger.info('finished work on contact %s, running count: %d', nodeID, contactCount);
    if (err) {
      logger.error(err.message);
    }
    if (rl.closed && contactCount == 0) {
      // THE END all contacts finished
      logger.info('done! finished running all contacts');
      closeProgram();
    } else if (rl.paused && contactCount < CONTACT_CONCURRENCY) {
      rl.resume();
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
          // querying mongo for a shard hash greater than (but close to) random generated crypto value
          $gte: crypto.randomBytes(20).toString('hex')
        }
        // for auditing: add `.limit(10)`, or however many,  before `.cursor()`
      }).limit(10).cursor();

      let shardCount = 0;
      let shardCursorEnded = false;

      cursor.on('error', (err) => {
        logger.error('cursor error for contact %s', err.message);
        next(err);
      });

      cursor.on('end', () => {
        shardCursorEnded = true;
        if (shardCount == 0) {
          // THE END there were no shards
          next();
        }
      });

      cursor.on('data', function (shard) {
        shardCount++;
        logger.info('contact %s shard %s started, running shards: %d',
          nodeID, shard.hash, shardCount)
        if (shardCount >= SHARD_CONCURRENCY) {
          cursor.pause();
        };

        function finish(err) {
          shardCount--;
          logger.info('contact %s shard %s finished, running shards: %d',
            nodeID, shard.hash, shardCount)
          if (err) {
            logger.error(err.message);
          }
          console.log('contact %s, shardCount: %d, shardCursorEnded: %s', nodeID, shardCount, shardCursorEnded);
          if (shardCount === 0 && shardCursorEnded) {
            // THE END all shards have been downloaded
            logger.info('all shards downloaded for contact %s', nodeID)
            next();
          } else if (shardCount < SHARD_CONCURRENCY) {
            cursor.resume();
          }
        };

        storage.models.Contact.findOne({ '_id': nodeID }, function (err, contact) {
          if (err) {
            return finish(err);
          }
          if (!contact) {
            shardResults[sanitizeNodeID(shard.hash)] = ERROR_CONTACT;
            return finish(new Error('contact not found: ' + nodeID));
          }

          // creating instance of storj.Contact and storj.Contract
          contact = storj.Contact(contact);
          const contractData = shard.contracts.filter((contract) => {
            return contract.nodeID == nodeID;
          })[0];

          if (!contractData || !contractData.contract) {
            logger.error('contract not found node %s shard %s', nodeID, shard.hash);
            shardResults[sanitizeNodeID(shard.hash)] = ERROR_CONTRACT;
            return finish(new Error('contract not found'));
          }

          const contract = storj.Contract.fromObject(contractData.contract);

          network.getRetrievalPointer(contact, contract, function (err, pointer) {
            if (err || !pointer || !pointer.token) {
              logger.warn('no token for contact %j and contract %j', contact, contract);
              shardResults[sanitizeNodeID(shard.hash)] = ERROR_TOKEN;
              return finish();
            }

            const filedir = getDirectoryPath(shard.hash);

            mkdirp(filedir, function (err) {
              if (err) {
                return finish(err);
              }
              logger.info('creating open file for shard %s', shard.hash);
              const file = fs.createWriteStream(path.resolve(filedir, shard.hash));
              file.on('close', function () {
                logger.info('file closed for shard %s', shard.hash);
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
                  shardResults[sanitizeNodeID(shard.hash)] = SUCCESS;
                  logger.info('shard %s successfully downloaded', shard.hash);
                } else {
                  shardResults[sanitizeNodeID(shard.hash)] = ERROR_HASH;
                  logger.info('shard %s failed to download, actual: %s', shard.hash, actual);
                }
                finish();
              });

              shardStream.on('error', (err) => {
                shardResults[sanatizeNodeID(shard.hash)] = ERROR_STREAM;
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
        logger.info('saved state for %s', nodeID);
        if (err) {
          return next(err);
        }
        next();
      });
    }
  ], contactFinish)
});