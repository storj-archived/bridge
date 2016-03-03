/**
 * @class metadisk/models/shard
 */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const StorageItem = require('storj').StorageItem;
const options = require('../options');

/**
 * Represents a shard stored on a user's behalf in the network
 * @constructor
 */
var ShardSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true,
    unique: true
  },
  contracts: [{
    nodeID: { type: String },
    contract: { type: Object }
  }],
  trees: [{
    nodeID: { type: String },
    tree: { type: Array }
  }],
  challenges: [{
    nodeID: { type: String },
    challenge: { type: Object }
  }],
  meta: [{
    nodeID: { type: String },
    meta: { type: Object }
  }]
});

options.apply(ShardSchema);

ShardSchema.set('toObject', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;

    doc.contracts = doc.contracts || [];
    doc.trees = doc.trees || [];
    doc.challenges = doc.challenges || [];
    doc.meta =  doc.meta || [];

    ret.contracts = {};
    ret.trees = {};
    ret.challenges = {};
    ret.meta = {};

    for (let i = 0; i < doc.contracts.length; i++) {
      ret.contracts[doc.contracts[i].nodeID] = doc.contracts[i].contract;
    }

    for (let i = 0; i < doc.trees.length; i++) {
      ret.trees[doc.trees[i].nodeID] = doc.trees[i].tree;
    }

    for (let i = 0; i < doc.challenges.length; i++) {
      ret.challenges[doc.challenges[i].nodeID] = doc.challenges[i].challenge;
    }

    for (let i = 0; i < doc.meta.length; i++) {
      ret.meta[doc.meta[i].nodeID] = doc.meta[i].meta;
    }
  }
});

/**
 * Creates a shard record from the supplied storj.StorageItem
 * @param {storj.StorageItem} item
 * @param {Function} callback
 */
ShardSchema.statics.create = function(item, callback) {
  assert(item instanceof StorageItem, 'Invalid StorageItem supplied');

  let Shard = this;

  Shard.findOne({ hash: item.hash }, function(err, shard) {
    if (err) {
      return callback(err);
    }

    shard = shard || new Shard({ hash: item.hash });

    shard.contracts = [];
    shard.trees = [];
    shard.challenges = [];
    shard.meta = [];

    for (let nodeID in item.contracts) {
      shard.contracts.push({
        nodeID: nodeID,
        contract: item.contracts[nodeID].toObject()
      });
    }

    for (let nodeID in item.trees) {
      shard.trees.push({
        nodeID: nodeID,
        tree: item.trees[nodeID]
      });
    }

    for (let nodeID in item.challenges) {
      shard.challenges.push({
        nodeID: nodeID,
        challenge: item.challenges[nodeID]
      });
    }

    for (let nodeID in item.meta) {
      shard.meta.push({
        nodeID: nodeID,
        meta: item.meta[nodeID]
      });
    }

    shard.save(function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, shard);
    });
  });
};

module.exports = function(connection) {
  return connection.model('Shard', ShardSchema);
};
