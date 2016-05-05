'use strict';

const storj = require('storj');
const inherits = require('util').inherits;
const assert = require('assert');
const Storage = require('./index');

/**
 * Implements a MongoDB storage adapter for contract and audit management
 * @constructor
 * @extends {storj.StorageAdapter}
 * @param {Storage} storage - Instance of {@link Storage} for Bridge
 */
function MongoAdapter(storage) {
  if (!(this instanceof MongoAdapter)) {
    return new MongoAdapter(storage);
  }

  assert(storage instanceof Storage, 'Invalid Storage instance supplied');
  storj.StorageAdapter.call(this);

  this._model = storage.models.Contracts;
}

inherits(MongoAdapter, storj.StorageAdapter);

/**
 * Implements the abstract {@link storj.StorageAdapter#_get}
 * @private
 * @param {String} key
 * @param {Function} callback
 */
MongoAdapter.prototype._get = function(key, callback) {
  this._model.getAllShardItemsByHash({ hash: key }, function(err, shardItem) {
    if (err) {
      return callback(err);
    }

    if (!contracts) {
      return callback(new Error('Shard data not found'));
    }

    callback(null, new storj.StorageItem(shardItem));
  });
};

/**
 * Implements the abstract {@link storj.StorageAdapter#_put}
 * @private
 * @param {String} key
 * @param {storj.StorageItem} item
 * @param {Function} callback
 */
MongoAdapter.prototype._put = function(key, item, callback) {
  assert(item instanceof storj.StorageItem, 'Invalid StorageItem supplied');
  //TODO: include contracts model here
  this._model.create(item, callback);
};

/**
 * Implements the abstract {@link storj.StorageAdapter#_del}
 * @private
 * @param {String} key
 * @param {Function} callback
 */
MongoAdapter.prototype._del = function(key, callback) {
  // NB: Bridge does not store data shards, so there is no reason to try and
  // NB: reap stale data. We always want a record of the contracts, audtits,
  // NB: and challenges, so this method is just a passthrough to maintain
  // NB: compatibility with `storj/core`.
  callback(null);
};

/**
 * Implements the abstract {@link storj.StorageAdapter#_keys}
 * @private
 * @param {Function} callback
 */
MongoAdapter.prototype._keys = function(callback) {
  // NB: Bridge does not store data shards, so there is no reason to try and
  // NB: reap stale data. We always want a record of the contracts, audtits,
  // NB: and challenges, so this method is just a passthrough to maintain
  // NB: compatibility with `storj/core`.
  callback(null, []);
};

module.exports = MongoAdapter;
