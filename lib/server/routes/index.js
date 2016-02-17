/**
 * @module metadisk/server/routes
 */

'use strict';

const assert = require('assert');

const Storage = require('../../storage');
const Network = require('storj').Network;

/**
 * Returns server routes bound to a given storage and network
 * @function
 * @param {Storage} storage
 * @param {Network} network
 */
function RouteFactory(config, storage, network, mailer) {
  assert(storage instanceof Storage, 'Invalid storage supplied');
  assert(network instanceof Network, 'Invalid network supplied');

  var bound = {};
  var unbound = {
    buckets: require('./buckets'),
    pubkeys: require('./pubkeys'),
    users: require('./users')
  };

  for (let path in unbound) {
    bound[path] = unbound[path](config, storage, network, mailer);
  }

  return bound;
}

module.exports = RouteFactory;
