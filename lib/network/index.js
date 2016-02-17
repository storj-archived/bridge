/**
 * @class metadisk/network
 */

'use strict';

const fs = require('fs');
const assert = require('assert');
const storj = require('storj');

/**
 * Represents an interface to the storj network
 * @function
 * @param {Object} options
 * @param {Function} callback
 */
module.exports.createInterface = function(options, callback) {
  assert.ok(options, 'Invalid options supplied');
  assert(typeof callback === 'function', 'You must supply a callback function');

  if (!fs.existsSync(options.datadir)) {
    fs.mkdirSync(options.datadir);
  }

  let keypair = storj.KeyPair(options.privkey);
  let network = storj.Network(keypair, {
    loglevel: 2,
    seeds: [],
    datadir: options.datadir,
    contact: {
      address: options.address,
      port: options.port,
    },
    farmer: false
  });

  return network.join(callback);
};
