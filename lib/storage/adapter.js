'use strict';

const storj = require('storj');
const inherits = require('util').inherits;
const assert = require('assert');
const Storage = require('./index');

/**
 * Implements a MongoDB storage adapter for contract and audit management
 * @constructor
 * @extends {storj.StorageAdapter}
 * @param {Storage} storage - Instance of {@link Storage} for MetaDisk
 */
function MongoAdapter(storage) {
  if (!(this instanceof MongoAdapter)) {
    return new MongoAdapter(storage);
  }

  assert(storage instanceof Storage, 'Invalid Storage instance supplied');
  storj.StorageAdapter.call(this);

  this._model = storage.models.Shard;
}

inherits(MongoAdapter, storj.StorageAdapter);

/**
 * Implements the abstract {@link storj.StorageAdapter#_get}
 * @private
 * @param {String} key
 * @param {Function} callback
 */
MongoAdapter.prototype._get = function(key, callback) {
  this._model.findOne({ hash: key }, function(err, shard) {
    if (err) {
      return callback(err);
    }

    if (!shard) {
      return callback(new Error('Shard data not found'));
    }

    callback(null, new storj.StorageItem(shard.toObject()));
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

  this._model.create(item, callback);
};

module.exports = MongoAdapter;
