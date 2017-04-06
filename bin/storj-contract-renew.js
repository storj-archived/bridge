#!/usr/bin/env node

'use strict';

const async = require('async');
const ms = require('ms');
const storj = require('storj-lib');
const program = require('commander');
const Config = require('../lib/config');
const Storage = require('storj-service-storage-models');
const complex = require('storj-complex');

program.version(require('../package').version);
program.option('-c, --config <path_to_config_file>', 'path to the config file');
program.option('-d, --datadir <path_to_datadir>', 'path to the data directory');
program.parse(process.argv);

const NOW = Date.now();
const HOURS_24 = ms('24h');

const logger = require('kad-logger-json')(0);
const config = new Config(process.env.NODE_ENV || 'develop', program.config,
                          program.datadir);
const { mongoUrl, mongoOpts } = config.storage;
const storage = new Storage(mongoUrl, mongoOpts, { logger });
const network = complex.createClient(config.complex);
const cursor = storage.models.Shard.find({
  'contracts.contract.store_end': {
    $gte: NOW,
    $lte: NOW + HOURS_24
  }
}).cursor();
const counter = { processed: 0, renewed: 0, errored: 0, errors: [] };

cursor
  .on('error', handleCursorError)
  .on('data', handleCursorData)
  .on('end', handleCursorClose);

/**
 * Prints the error and continues processing cursor
 * @function
 * @param {error} error
 */
function handleCursorError(err) {
  process.stderr.write(JSON.stringify({ error: err.message }));
  process.exit(1);
}

/**
 * Prints close event + cleanup + report
 * @function
 */
function handleCursorClose() {
  process.stdout.write(JSON.stringify(counter));
  process.exit();
}

/**
 * Inspects the contract to ensure it's still valid and in use
 * If the end time is within 24 hours, renew it for another 3 months
 * @function
 * @param {object} shard
 */
function handleCursorData(shard) {
  let needsRenewal = [];

  cursor.pause();

  for (let contractInfo of shard.contracts) {
    let { contract: contractObj, nodeID } = contractInfo;
    let contract = new storj.Contract(contractObj);

    needsRenewal.push([nodeID, contract]);
  }

  let renewalContracts = needsRenewal.map(([nodeId, contract]) => {
    contract.set('store_end', NOW + ms('90d'));

    return [nodeId, contract];
  });

  async.map(renewalContracts, lookupFarmer, maybeRenewContracts);
}

function lookupFarmer([nodeId, contract], next) {
  storage.models.Contact.findOne({ _id: nodeId }, (err, contact) => {
    if (err || !contact) {
      counter.errored++;
      return next(null, null);
    }

    next(null , [storj.Contact(contact.toObject()), contract]);
  });
}

function maybeRenewContracts(err, results) {
  let canBeRenewed = results.filter((result) => !!result);

  async.eachLimit(canBeRenewed, 6, checkIfNeedsRenew,
                  () => cursor.resume());
}

function finishProcessingContract(done) {
  counter.processed++;
  done();
}

function checkIfNeedsRenew([contact, contract], done) {
  let shardHash = contract.get('data_hash');

  async.waterfall(
    [
      (next) => getPointerObjects(shardHash, next),
      (pointers, next) => getAssociatedFrames(pointers, next),
      (frames, next) => getParentBucketEntries(frames, next),
      (next) => renewContract([contact, contract], next)
    ],
    () => finishProcessingContract(done)
  );
}

function getPointerObjects(shardHash, next) {
  storage.models.Pointer.find({ hash: shardHash }, (err, pointers) => {
    next(err || pointers.length === 0, pointers);
  });
}

function getAssociatedFrames(pointers, next) {
  storage.models.Frame.find({
    shards: {
      $in: pointers.map((pointer) => pointer._id)
    }
  }, (err, frames) => {
    next(err || frames.length === 0, frames);
  });
}

function getParentBucketEntries(frames, next) {
  storage.models.BucketEntry.find({
    frame: {
      $in: frames.map((frame) => frame._id)
    }
  }, (err, entries) => {
    next(err || entries.length === 0);
  });
}

function updateContractRecord(contact, contract, next) {
  storage.models.Shard.findOne({
    hash: contract.get('data_hash')
  }, function(err, shard) {
    if (err) {
      return next(err);
    }

    for (let contract of shard.contracts) {
      if (contract.nodeID !== contact.nodeID) {
        continue;
      }

      contract.contract = contract.toObject();
    }

    shard.save(next);
  });
}

function renewContract([contact, contract], next) {
  network.renewContract(contract, contact, (err) => {
    if (err) {
      counter.errors.push({ contract, contact, error: err.message });
      counter.errored++;
      next();
    } else {
      counter.renewed++;
      updateContractRecord(contact, contract, next);
    }
  });
}
