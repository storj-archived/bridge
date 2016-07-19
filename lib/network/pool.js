'use strict';

const inherits = require('util').inherits;
const hat = require('hat');
const storj = require('storj');
const log = require('../logger');
const MongoAdapter = require('../storage/adapter');

/**
 * Renterpool is a work queue for minions and exposes an RenterInterface style API
 * for messaging a minion in the pool and proxying the result back to the main
 * process.
 * @constructor
 * @param {Object} options - Network configuration
 */
function RenterPool(options, messaging) {
  if (!(this instanceof RenterPool)) {
    return new RenterPool(options);
  }

  this._options = options;
  this._manager = new storj.Manager(new MongoAdapter(options.storage));
  this.messaging = messaging;
  this.messaging.on('message', (msg) => {
    this._processMessage(msg);
  });

  this._pendingCallbacks = {};

}

/**
 * Proxy RenterInterface#getStorageOffer
 */
RenterPool.prototype.getStorageOffer = function(contract, callback) {
  log.info('[renterpool] getting storage offer');
  this._send('getStorageOffer', [contract.toObject()], callback);
};

/**
 * Proxy RenterInterface#getStorageProof
 */
RenterPool.prototype.getStorageProof = function(farmer, item, callback) {
  log.info('[renterpool] getting storage proof');
  this._send('getStorageProof', [farmer, item], callback);
};

/**
 * Proxy RenterInterface#getConsignToken
 */
RenterPool.prototype.getConsignToken = function(f, c, a, callback) {
  log.info('[renterpool] getting consign token');
  //const contract = JSON.parse(c);
  this._send('getConsignToken', [f, c, {
    challenges: a.getPrivateRecord().challenges,
    tree: a.getPublicRecord()
  }], callback);
};

/**
 * Proxy RenterInterface#getRetrieveToken
 */
RenterPool.prototype.getRetrieveToken = function(farmer, contract, callback) {
  log.info('[renterpool] getting retrieve token');
  this._send('getRetrieveToken', [farmer, contract.toObject()], callback);
};

/**
 * Asks a minion for her connected contacts
 */
RenterPool.prototype.getConnectedContacts = function(callback) {
  log.info('[renterpool] getting connected contacts');
  this._send('_getConnectedContacts', [], callback);
};

/**
 * Processes the message and calls pending callback
 * @private
 * @param {String} nodeId
 * @param {Object} message
 */
RenterPool.prototype._processMessage = function(msg) {
  log.info(`Attempting to process message with correlationId ${msg.properties.correlationId}`);
  if (!this._pendingCallbacks[msg.properties.correlationId]) {
    log.warn(`Not processing message with correlationId ${msg.properties.correlationId}`);
    return false;
  }
  const message = JSON.parse(msg.content.toString());
  log.info(`Processing message with correlationId ${msg.properties.correlationId}`);
  let args = message.error ? [] : message.result;

  this._pendingCallbacks[msg.properties.correlationId].callback.apply(
    this,
    message.error ? [new Error(message.error.message)] : args
  );

  delete this._pendingCallbacks[msg.properties.correlationId];
};

/**
 * Send the message to the next minion of the specified one and sets up a
 * pending callback
 * @private
 * @param {String} method
 * @param {Array} params
 * @param {Function} callback
 */
RenterPool.prototype._send = function(method, params, callback) {
  let id = hat();
  this._pendingCallbacks[id] = { method: method, callback: callback };

  const message = JSON.stringify({ method: method, params: params });
  return this.messaging.send(
    message,
    this.messaging.queues.renterpool,
    {
      messageId: id,
      replyTo: this.messaging.queues.callback
    }
  );
};

module.exports = RenterPool;
