#!/usr/bin/env node

'use strict';

const async = require('async');
const ms = require('ms');
const storj = require('storj-lib');
const program = require('commander');
const Config = require('../lib/config');
const Storage = require('storj-service-storage-models');
const { Client: ComplexClient } = require('storj-complex');

program.version(require('../package').version);
program.option('-c, --config <path_to_config_file>', 'path to the config file');
program.option('-d, --datadir <path_to_datadir>', 'path to the data directory');
program.parse(process.argv);

const NOW = Date.now();
const HOURS_24 = ms('24h');

const logger = require('../lib/logger');
const config = new Config(process.env.NODE_ENV || 'develop', program.config,
                          program.datadir);
const { mongoUrl, mongoOpts } = config.storage;
const storage = new Storage(mongoUrl, mongoOpts, { logger });
const network = new ComplexClient(config.complex);
const cursor = storage.models.Shard.find({
  'contracts.contract.store_end': {
    $gte: NOW,
    $lte: { $add: [NOW, HOURS_24] }
  }
}).cursor();
const counter = { processed: 0, renewed: 0, errored: 0 };

cursor
  .on('error', handleCursorError)
  .on('data', handleCursorData)
  .on('close', handleCursorClose);

/**
 * Prints the error and continues processing cursor
 * @function
 * @param {error} error
 */
function handleCursorError(err) {
  logger.warn(err.message);
}

/**
 * Prints close event + cleanup + report
 * @function
 */
function handleCursorClose() {
  logger.info('shard renewal job completed');
  logger.info('total contracts processed: %i', counter.processed);
  logger.info('total contracts renewwed: %i', counter.renewed);
  logger.info('total contracts errored: %i', counter.errored);
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
    let willExpireNext24 = (contract.get('store_end') - HOURS_24) <= NOW;

    if (willExpireNext24) {
      needsRenewal.push([nodeID, contract]);
    }
  }

  let renewalContracts = needsRenewal.map(([nodeId, contract]) => {
    contract.set('store_begin', NOW);
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

  async.parallelLimit(canBeRenewed, 6, checkIfNeedsRenew,
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
      (entries, next) => renewContract([contact, contract], entries, next)
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
    $in: {
      pointers: pointers.map((pointer) => pointer._id)
    }
  }, (err, frames) => {
    next(err || frames.length === 0, frames);
  });
}

function getParentBucketEntries(frames, next) {
  storage.models.BucketEntry.find({
    $in: {
      frame: frames.map((frame) => frame._id)
    }
  }, (err, entries) => {
    next(err || entries === 0, entries);
  });
}

function renewContract([contact, contract], entries, next) {
  network.renewContract(contract, contact, (err) => {
    if (err) {
      counter.errored++;
    } else {
      counter.renewed++;
    }

    next();
  });
}
