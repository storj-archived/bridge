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
const through = require('through');
const levelup = require('levelup');
const leveldown = require('leveldown');
const logger = require('../lib/logger');
const readline = require('readline');
const assert = require('assert');

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

function getPath(shardHash) {
  // creating two directories based on first two bytes
  return path.resolve(DOWNLOAD_DIR, shardHash.slice(0, 2), shardHash.slice(2, 4), shardHash)
}

rl.on('line', function(nodeID) {
  let contactCount = 0;
  contactCount++;
  if (contactCount >= CONTACT_CONCURRENCY) {
    rl.pause();
  };
  function contactFinish(err) {
    contactCount--;
    if (err) {
      logger.error(err.message);
    }
    if (contactCount < CONTACT_CONCURRENCY) {
      rl.resume();
    }
  };

  const shardResults = {};
  async.waterfall([
    (next) => {
      db.get(nodeID, function(err) {
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
      }).limit(10).cursor()
      next(null, cursor)
    },
    (cursor, next) => {
      storage.models.Contact.findOne({'_id': nodeID}, function(err, contact) {
        if (err) {
          return next(err);
        }
        if (!contact) {
          return next(new Error('contact not found: ' + nodeID));
        }
        // creating instance of storj.Contact and storj.Contract
        contact = storj.Contact(contact);
        const contract = storj.Contract(shard.contract.filter((contract) => {
          return contracts.nodeID == nodeID;
        })[0]);
        next(null, cursor, contact);
      });
    },
    (cursor, contact, next) => {
      let count = 0;
      cursor.on('error', next);
      cursor.on('end', next);
      cursor.on('data', function(shard) {
        count++;
        if (count >= SHARD_CONCURRENCY) {
          cursor.pause();
        };
        function finish(err) {
          count--;
          console.error(err);
          if (count < SHARD_CONCURRENCY) {
            cursor.resume();
          }
        };
        network.getRetrievalPointer(contact, contract, function(err, pointer) {
          if (err || !pointer || !pointer.token) {
            logger.warn('no token for contact %j and contract %j', contact, contract);
            shardResults[shard.hash] = false;
            return finish();
          }
          const file = fs.open(getPath(shard.hash), 'w');
          const hash = crypto.createHash('sha256');
          const hasher = through(function(data) {
            hash.update(data);
          });
          // piping to hasher then to file as shard data is downloaded
          const shardStream = storj.utils.createShardDownloader(contact, shard.hash, pointer.token).pipe(hasher).pipe(file);
          shardStream.on('close', function() {
            if (hasher.digest('hex') == shard.hash) {
              shardResults[shard.hash] = true;
            } else {
              shardResults[shard.hash] = false;
            }
            finish();
          });
          shardStream.on('error', finish);
        });
      }, next);
    },
    (next) => {
      db.put(nodeID, shardResults, next);
    }
  ], contactFinish)
});
