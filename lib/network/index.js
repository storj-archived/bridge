/**
 * @module storj-bridge/network
 */

'use strict';

const fs = require('fs');
const assert = require('assert');
const storj = require('storj');
const logger = require('../logger');
const MongoAdapter = require('../storage/adapter');

/**
 * Represents an interface to the storj network
 * @static
 * @param {Object} options
 * @param {Function} callback
 */
module.exports.createInterface = function(options, callback) {
  assert.ok(options, 'Invalid options supplied');
  assert(typeof callback === 'function', 'You must supply a callback function');

  if (!fs.existsSync(options.datadir)) {
    fs.mkdirSync(options.datadir);
  }

  let storage = options.storage;
  let adapter = new MongoAdapter(storage);
  let manager = new storj.Manager(adapter);

  storage.models.Contact.recall(3, function(err, seeds) {
    if (err) {
      return callback(err);
    }

    let network = storj.RenterInterface({
      keypair: storj.KeyPair(options.privkey),
      manager: manager,
      logger: logger,
      seeds: seeds.map(function(seed) {
        return seed.toString();
      }),
      address: options.address,
      port: options.port,
      tunnels: options.tunnels,
      noforward: true,
      tunport: options.tunport,
      gateways: options.gateways
    });

    network._router.on('add', function(contact) {
      storage.models.Contact.record(contact);
    });

    network._router.on('shift', function(contact) {
      storage.models.Contact.record(contact);
    });

    return network.join(callback);
  });
};
