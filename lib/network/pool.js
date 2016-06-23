'use strict';

const async = require('async');
const EventEmitter = require('events').EventEmitter;
const inherits = require('util').inherits;
const hat = require('hat');
const storj = require('storj');
const log = require('../logger');
const childproc = require('child_process');
const MongoAdapter = require('../storage/adapter');

/**
 * Creates a pool of renter minions and exposes an RenterInterface style API
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

  this._lastMinionIndex = 0;
  this._minions = {};
  this._pendingCallbacks = {};

  this._forkMinions();

  process.on('exit', this._killall.bind(this, false));
  process.on('uncaughtException', this._killall.bind(this, true));

  EventEmitter.call(this);
}

inherits(RenterPool, EventEmitter);

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
 * Kills all the renter minions
 * @private
 */
RenterPool.prototype._killall = function(exit, err) {
  log.warn('[renterpool] killing minions');
  for (let id in this._minions) {
    this._minions[id].kill();
  }

  this._minions = {};

  if (exit) {
    log.error(err.stack);
    process.exit();
  }
};

/**
 * Forks N renter minions into child processes
 * @private
 * @returns {Array}
 */
RenterPool.prototype._forkMinions = function() {
  let self = this;

  function _onReady() {
    self.emit('ready');
  }

  if (!this._options.minions.length) {
    return setImmediate(_onReady);
  }

  let minionCount = 0;
  async.each(this._options.minions, function(config, done) {
    log.info('[renterpool] forking renter minion process', minionCount);

    let minion = childproc.fork('./bin/minion.js', [JSON.stringify(config)], {
      stdio: 'inherit'
    });

    minion.once('message', function(msg) {
      if (msg === 'ready') {
        done();
      }
    });

    self._setupIpcListeners(minionCount.toString(), minion);

    self._minions[minionCount.toString()] = minion;
    minionCount++;
  }, _onReady);
};

/**
 * Setup IPC listeners for a given minion process
 * @private
 * @param {String} nodeId
 * @param {ChildProcess} proc
 */
RenterPool.prototype._setupIpcListeners = function(minionNumber, proc) {
  var self = this;

  proc.on('error', function(err) {
    log.error('[renterpool] renter minion %s encountered an error: %s', minionNumber, err.message);
  });

  proc.on('exit', function() {
    log.error('[renterpool] renter minion %s exited', minionNumber);
    self._replaceMinion(minionNumber);
  });
};

/**
 * Replaces the minion with a new instance
 * @private
 * @param {String} nodeId
 */
RenterPool.prototype._replaceMinion = function(minionNumber) {
  this._minions[minionNumber].kill();

  log.info('[renterpool] attempting to replace minion %s', minionNumber);

  log.info('[renterpool] replacing minion %s', minionNumber);

  let minion = childproc.fork('./bin/minion.js', [
    JSON.stringify(this._options.minions[minionNumber])
  ], { stdio: 'inherit' });

  this._setupIpcListeners(minionNumber, minion);

  this._minions[minionNumber] = minion;
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
