/**
 * @class metadisk/network
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
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

  this._bootstrap();

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

  this._contact = MetaDiskContact({
    address: this._options.address,
    port: this._options.port,
    pubkey: this._keypair.getPublicKey()
  });

  this._transport = kad.transports.UDP(this._contact, { logger: logger });

  this._router = kad.Router({
    transport: this._transport,
    validator: this._validator,
    logger: logger
  });

  this._dht = kad.Node({
    transport: this._transport,
    router: this.router,
    logger: logger,
    storage: storage,
    validator: this._validator
  });
};

/**
 * Validates a key value pair by 2 rounds of sha256
 * #_validator
 * @param {String} key
 * @param {String} value
 * @param {Function} callback
 */
Network.prototype._validator = function(key, value, callback) {
  function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  callback(key === sha256(sha256(value)));
};

/**
 * Returns a readable stream of file chunks as they become available
 * #createReadStream
 * @param {String} key
 */
Network.prototype.createReadStream = function(key) {
  throw new Error('Method not implemented');
};

/**
 * Returns a writable stream for storing a file in the network
 * #createWriteStream
 */
Network.prototype.createWriteStream = function() {
  throw new Error('Method not implemented');
};

module.exports = Network;
