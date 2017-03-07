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

const logger = require('../lib/logger');
const config = new Config(process.env.NODE_ENV || 'develop', program.config,
                          program.datadir);
const { mongoUrl, mongoOpts } = config.storage;
const storage = new Storage(mongoUrl, mongoOpts, { logger });
const network = new ComplexClient(config.complex);
const itemStream = storage.models.Shard.find({}).cursor();
const counter = { processed: 0, renewed: 0, errored: 0 };

const cursor
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

  async.map(renewalContracts, ([nodeId, contract], next) => {
    storage.models.Contact.findOne({ _id: nodeId }, (err, contact) => {
      if (err || !contact) {
        counter.errored++;
        return next(null, null);
      }

      next(null , [storj.Contact(contact.toObject()), contract]);
    }, (err, results) => {
      let canBeRenewed = results.filter((result) => !!result);

      async.parallelLimit(canBeRenewed, 6, ([contact, contract], done) => {
        counter.processed++;
        network.renewContract(contact, contract, (err) => {
          if (err) {
            counter.errored++;
          } else {
            counter.renewed++;
          }

          done();
        });
      }, () => cursor.resume());
    });
  })
}
