'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const async = require('async');

/**
 * Represents a shard stored on a user's behalf in the network
 * @constructor
 */
var ShardContractSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true
  },
  contract: {
    type                   : { type: String },
    renter_id              : { type: String },
    renter_signature       : { type: String },
    farmer_id              : { type: String },
    farmer_signature       : { type: String },
    data_size              : { type: Number },
    store_begin            : { type: Number },
    store_end              : { type: Number },
    audit_count            : { type: Number },
    payment_storage_price  : { type: Number },
    payment_download_price : { type: Number },
    payment_destination    : { type: String }
  },
  tree       : [ { type: String } ],
  challenges : [ { type: String } ],
  meta       : { type: Object }
});

ShardContractSchema.plugin(SchemaOptions, {
  read: 'secondaryPreferred'
});

ShardContractSchema.set('toObject', {
  transform: function(doc, ret) {
    let result = {
      contracts  : {},
      trees      : {},
      challenges : {},
      meta       : {}
    };

    result.contracts[ret.contract.farmer_id] = doc.contract;
    result.contracts[ret.contract.farmer_id].data_hash = ret.hash;
    result.trees[ret.contract.farmer_id] = doc.tree;
    result.challenges[ret.contract.farmer_id] = doc.challenges;
    result.meta[ret.contract.farmer_id] = doc.meta;

    ret = result;
  }
});

/**
 * Finds all shard contracts associated with a shard hash
 * @param {String} hash of shard
 * @param {Function} callback
 */
ShardContractSchema.statics.getAllShardItemsByHash = function(hash, callback) {
  this.find({ hash: hash }, function(err, contracts) {
    if (err) {
      return callback(err);
    }

    if (!contracts) {
      return callback(new Error('Shard data not found'));
    }

    let contractMap = contracts.map(function(contract) {
      return contract.toObject();
    });

    return callback(null, Object.assign.apply(null, contractMap));
  });
};

/**
 * Creates a shard contract record from the supplied storj.StorageItem
 * @param {storj.StorageItem} item
 * @param {Function} callback
 */

ShardContractSchema.statics.create = function(item, callback) {
  assert(item instanceof StorageItem, 'Invalid StorageItem supplied');
  let ShardContract = this;
  let newDocsObj = {};
  let formattedDoc = {};

  for (let nodeID in item.contracts) {
    newDocsObj[nodeID] = newDocsObj[nodeID] || {};
    newDocsObj[nodeID].contract = item.contracts[nodeID];
  }

  for (let nodeID in item.trees) {
    newDocsObj[nodeID] = newDocsObj[nodeID] || {};
    newDocsObj[nodeID].tree = item.trees[nodeID];
  }

  for (let nodeID in item.challenges) {
    newDocsObj[nodeID] = newDocsObj[nodeID] || {};
    newDocsObj[nodeID].challenge = item.challenges[nodeID];
  }

  for (let nodeID in item.meta) {
    newDocsObj[nodeID] = newDocsObj[nodeID] || {};
    newDocsObj[nodeID].meta = item.meta[nodeID];
  }

  async.each(newDocsObj, saveNewContract, function(err) {
    if(err) {
      callback(err);
    }
    callback(formattedDoc);
  });

  function saveNewContract(value, key, callback) {
    let newContract = Object.assign({hash: item.hash}, newDocsObj[key]);
    let contract = new ShardContract(newContract);
    contract.save(function(err, contractDoc) {
      if (err) {
        return callback(err);
      }
      formattedDoc = Object.assign(contractDoc.toObject(), formattedDoc);
      callback();
    });
  }
};

/**
 * Finds all shard contracts within a given time frame
 * @param {Object} options
 * @param {Number} options.start - Timestamp
 * @param {Buffer} options.shard - Data to create audit challenges for

ShardContractSchema.statics.getContractsByTime = function(options) {
  this.find({ hash: hash }, function(err, contracts) {

  });

  options.startTime,
  options.endTime
};
*/
module.exports = function(connection) {
  return connection.model('ShardContract', ShardContractSchema);
};
