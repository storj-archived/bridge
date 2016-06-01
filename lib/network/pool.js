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
function RenterPool(options) {
  if (!(this instanceof RenterPool)) {
    return new RenterPool(options);
  }

  var self = this;

  this._options = options;
  this._keypair = new storj.KeyPair(options.privkey);
  this._manager = new storj.Manager(new MongoAdapter(options.storage));
  this._lastMinionIndex = 0;
  this._minions = {};
  this._pendingCallbacks = {};

  this._forkMinions();

  process.on('exit', function() {
    for (let id in self._minions) {
      self._minions[id].kill();
    }
  });

  EventEmitter.call(this);
}

inherits(RenterPool, EventEmitter);

/**
 * Proxy RenterInterface#getStorageOffer
 */
RenterPool.prototype.getStorageOffer = function(contract, callback) {
  this._send('getStorageOffer', [contract.toObject()], callback);
};

/**
 * Proxy RenterInterface#getStorageProof
 */
RenterPool.prototype.getStorageProof = function(farmer, item, callback) {
  this._send('getStorageProof', [farmer, item], callback);
};

/**
 * Proxy RenterInterface#getConsignToken
 */
RenterPool.prototype.getConsignToken = function(f, c, a, callback) {
  this._send('getConsignToken', [f, c.toObject(), {
    challenges: a.getPrivateRecord().challenges,
    tree: a.getPublicRecord()
  }], callback);
};

/**
 * Proxy RenterInterface#getRetrieveToken
 */
RenterPool.prototype.getRetrieveToken = function(farmer, contract, callback) {
  this._send('getRetrieveToken', [farmer, contract.toObject()], callback);
};

/**
 * Asks a minion for her connected contacts
 */
RenterPool.prototype.getConnectedContacts = function(callback) {
  this._send('_getConnectedContacts', [], callback);
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

  async.each(this._options.minions, function(config, done) {
    log.info('forking renter minion process');

    config.privkey = self._keypair.getPrivateKey();

    let nodeId = storj.KeyPair(config.privkey).getNodeID();
    let minion = childproc.fork('./bin/minion.js', [JSON.stringify(config)], {
      stdio: 'inherit'
    });

    minion.once('message', function(msg) {
      if (msg === 'ready') {
        done();
      }
    });

    self._setupIpcListeners(nodeId, minion);

    self._minions[nodeId] = minion;
  }, _onReady);
};

/**
 * Setup IPC listeners for a given minion process
 * @private
 * @param {String} nodeId
 * @param {ChildProcess} proc
 */
RenterPool.prototype._setupIpcListeners = function(nodeId, proc) {
  var self = this;

  proc.on('error', function(err) {
    log.error('renter minion %s encountered an error: %s', nodeId, err.message);
    self._replaceMinion(nodeId);
  });

  proc.on('exit', function() {
    log.error('renter minion %s exited', nodeId);
    self._replaceMinion(nodeId);
  });

  proc.on('message', function(message) {
    self._processMessage(nodeId, message);
  });
};

/**
 * Replaces the minion with a new instance
 * @private
 * @param {String} nodeId
 */
RenterPool.prototype._replaceMinion = function(nodeId) {
  this._minions[nodeId].kill();

  for (let opts in this._options.minions) {
    if (storj.KeyPair(this._options.privkey).getNodeID() === nodeId) {
      this._options.minions[opts].privkey = this._keypair.getPrivateKey();

      let minion = childproc.fork('./bin/minion.js', [
        JSON.stringify(this._options.minions[opts])
      ], { stdio: 'inherit' });

      this._setupIpcListeners(nodeId, minion);

      this._minions[nodeId] = minion;
    }
  }
};

/**
 * Processes the message and calls pending callback
 * @private
 * @param {String} nodeId
 * @param {Object} message
 */
RenterPool.prototype._processMessage = function(nodeId, message) {
  if (!this._pendingCallbacks[message.id]) {
    return false;
  }

  let args = message.error ? [] : this._castArguments(message).result;

  this._pendingCallbacks[message.id].callback.apply(
    this,
    message.error ? [new Error(message.error.message)] : args
  );

  delete this._pendingCallbacks[message.id];
};

/**
 * Cast arguments to appropriate types
 * @private
 */
RenterPool.prototype._castArguments = function(message) {
  let method = this._pendingCallbacks[message.id].method;

  switch (method) {
    case 'getStorageOffer':
      message.result[0] = storj.Contact(message.result[0]);
      message.result[1] = storj.Contract.fromJSON(message.result[1]);
      break;
    case 'getStorageProof':
      break;
    case 'getRetrieveToken':
      break;
    case 'getConsignToken':
      break;
    default:
      // noop
  }

  return message;
};

/**
 * Plucks the next renter minion in the pool
 * @private
 * @returns {ChildProcess}
 */
RenterPool.prototype._pluck = function() {
  var minionIds = Object.keys(this._minions);

  if (this._lastMinionIndex === minionIds.length) {
    this._lastMinionIndex = 0;
  }

  return this._minions[Object.keys(this._minions)[this._lastMinionIndex++]];
};

/**
 * Send the message to the next minion of the specified one and sets up a
 * pending callback
 * @private
 * @param {String} method
 * @param {Array} params
 * @param {String} nodeId
 * @param {Function} callback
 */
RenterPool.prototype._send = function(method, params, nodeId, callback) {
  let proc = null;

  if (typeof nodeId === 'function') {
    proc = this._pluck();
    callback = nodeId;
  } else {
    proc = this._minions[nodeId];
  }

  let id = hat();
  this._pendingCallbacks[id] = { method: method, callback: callback };

  proc.send({
    id: id,
    method: method,
    params: params
  });
};

module.exports = RenterPool;
