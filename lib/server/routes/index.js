/**
 * @module metadisk/server/routes
 */

'use strict';

const assert = require('assert');

const Storage = require('../../storage');
const Network = require('../../network');

/**
 * Returns server routes bound to a given storage and network
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function RouteFactory(storage, network) {
  assert(storage instanceof Storage, 'Invalid storage supplied');
  assert(network instanceof Network, 'Invalid network supplied');

  var bound = {};
  var unbound = {
    buckets: require('./buckets'),
    pubkeys: require('./pubkeys'),
    users: require('./users')
  };

  for (let path in unbound) {
    bound[path] = unbound[path](storage, network);
  }

  return bound;
}

module.exports = RouteFactory;
