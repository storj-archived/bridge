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

program
  .version('0.0.1')
	.command('command <req> [optional]','command description')
	.option('-c, --config <path_to_config_file>', 'path to the config file');
	.option('-d, --datadir <path_to_datadir>', 'path to the data directory');
	.parse(process.argv);

const config = new Config(process.env.NODE_ENV || 'develop', program.config,
                            program.datadir);
const network = complex.createClient(config.complex);
const { mongoUrl, mongoOpts } = config.storage;
const storage = new Storage(mongoUrl, mongoOpts, { logger });

// TODO:
// - grab contacts from stdin or something; generate set of nodeIDs
// - add logging

const SHARD_CONCURRENCY = 10;
const CONTACT_CONCURRENCY = 10;
const MAX_SHARDS = 10;
const contacts = ['8046d7daaa9f9c18c0dd12ddfa2a0f88edf1b17d'];

const DOWNLOAD_DIR = '/tmp';

const db = levelup(leveldown(path.resolve(DOWNLOAD_DIR, 'statedb'));

function getPath(shardHash) {
  // creating two directories based on first two bytes
  return path.resolve(DOWNLOAD_DIR, shardHash.slice(0, 2), shardHash.slice(2, 4), shardHash)
}

async.eachLimit(contacts, CONTACT_CONCURRENCY, function(nodeID, done) {
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
      storage.models.Shard.find({
        'contracts.nodeID': nodeID,
        'contracts.contract.store_end': {
          $gte: Date.now()
        },
        'hash': {
          $gte: crypto.randomBytes(20).toString('hex');
        }
      }).limit(MAX_SHARDS)
        .exec( function(err, shards){
          if (err) {
            return next(err)
          }
          if (!shards || !shards.length) {
            return next(new Error('no shards found'));
          }
          return next(null, shards);
        });
    },
    (shards, next) => {
      storj.models.Contact.findOne('_id': nodeID, function(err, contact) {
        if (err) {
          return next(err);
        }
        if (!contact) {
          // add log here - contact not found
          return next(new Error('contact not found'));
        }
        // creating instance of storj.Contact and storj.Contract
        contact = storj.Contact(contact);
        const contract = storj.Contract(shard.contract.filter((contract) => {
          return contracts.nodeID == nodeID
        })[0]);
        next(null, shards, contact);
      });
    },
    (shards, contact, next) => {
      async.eachLimit(shards, SHARD_CONCURRENCY, function(shard, shardDone) {
        network.getRetrievalPointer(contact, contract, function(err, pointer) {
          if (err || !pointer || !pointer.token) {
            // log here
            shardResults[shard.hash] = false;
            return next();
          }
          // worry about later:
          // contact that we give to complex client needs to be an instance of storj.contact
          const file = fs.open(getPath(shard.hash), 'w');
          const hash = crypto.createHash('sha256');
          const hasher = through( function(data) {
            hash.update(data)
          });
          // piping to hasher then to file as shard data is downloaded
          const shardStream = storj.utils.createShardDownloader(contact, shard.hash, pointer.token).pipe(hasher).pipe(file);
          shardStream.on('close', function() {
            if (hasher.digest('hex') == shard.hash) {
              shardResults[shard.hash] = true;
            } else {
              shardResults[shard.hash] = false;
            }
            next();
          });
          shardStream.on('error', next);
        });
      }, next);
    },
    (next) => {
      db.put(nodeID, shardResults, next);
    }
  ], (err) => {
    if (err) {
      console.error(err);
    }
  })
});
