/**
 * @class metadisk/network
 */

'use strict';

const assert = require('assert');
const kad = require('kad');
const spartacus = require('kad-spartacus');
const stream = require('readable-stream');

const MetaDiskContact = spartacus.ContactDecorator(
  kad.contacts.AddressPortContact
);

/**
 * Represents an interface to the storage network
 * @constructor
 * @param {Object} options
 */
function Network(options) {
  if (!(this instanceof Network)) {
    return new Network(options);
  }

  assert.ok(options, 'Invalid options supplied');

  this._options = options;
  this._keypair = spartacus.KeyPair(this._options.privkey);
  this._dht = this._bootstrap();

  if (this._options.seed && this._options.seed.address) {
    this._dht.connect(MetaDiskContact(this._options.seed));
  }
}

/**
 * Bootstraps the DHT
 * #_bootstrap
 */
Network.prototype._bootstrap = function() {
  const logger = kad.Logger(this._options.verbosity, 'MetaDisk');
  const storage = kad.storage.FS(this._options.datadir);
  const contact = MetaDiskContact({
    address: this._options.address,
    port: this._options.port,
    pubkey: this._keypair.getPublicKey()
  });
  const transport = kad.transports.UDP(contact, { logger: logger });
  const router = kad.Router({
    transport: transport,
    validator: this._validator,
    logger: logger
  });

  return kad.Node({
    transport: transport,
    router: router,
    logger: logger,
    storage: storage,
    validator: this._validator
  });
};

/**
 * Validates a key value pair
 * #_validator
 * @param {String} key
 * @param {String} value
 * @param {Function} callback
 */
Network.prototype._validator = function(key, value, callback) {
  // implement validation
  callback(true);
};

/**
 * Returns a readable stream of file chunks as they become available
 * #createReadStream
 * @param {String} key
 */
Network.prototype.createReadStream = function(key) {

};

/**
 * Returns a writable stream for storing a file in the network
 * #createWriteStream
 */
Network.prototype.createWriteStream = function() {

};

module.exports = Network;
