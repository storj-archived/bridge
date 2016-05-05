/**
 * @module metadisk-api/network
 */

'use strict';

const fs = require('fs');
const assert = require('assert');
const storj = require('storj');
const MongoAdapter = require('../storage/adapter');
const kad = require('kad');

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

    let network = storj.Network({
      keypair: storj.KeyPair(options.privkey),
      manager: manager,
      loglevel: process.env.NODE_ENV === 'test' ? 0 : (options.verbosity || 3),
      seeds: seeds.map(function(seed) {
        return seed.toString();
      }),
      datadir: options.datadir,
      contact: {
        address: options.address,
        port: options.port,
      },
      farmer: false,
      noforward: true
    });

    var whiteListArray = ["08b7dcddcfc84e2f02b9800e6720af787291166f", "3a3145039bf2dec51698fc6cfb3a4b68655523f2", "c5b5c81ef6fbb47d06b0c00043b01125eea19e8c"];
    network._transport.before('receive', kad.hooks.whitelist(whiteListArray));

    network._router.on('add', function(contact) {
      storage.models.Contact.record(contact);
    });

    network._router.on('shift', function(contact) {
      storage.models.Contact.record(contact);
    });

    return network.join(callback);
  });
};
