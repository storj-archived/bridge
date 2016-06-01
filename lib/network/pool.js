'use strict';

const hat = require('hat');
const storj = require('storj');
const log = require('../logger');
const childproc = require('child_process');

/**
 * Creates a pool of renter minions and exposes an RenterInterface style API
 * for messaging a minion in the pool and proxying the result back to the main
 * process.
 * @constructor
 * @param {Array} netconf - Array of network configuration for minions
 */
function RenterPool(netconf) {
  if (!(this instanceof RenterPool)) {
    return new RenterPool(netconf);
  }

  var self = this;

  this._options = netconf;
  this._lastMinionIndex = 0;
  this._minions = this._forkMinions();
  this._pendingCallbacks = {};

  process.on('exit', function() {
    for (let id in self._minions) {
      self._minions[id].kill();
    }
  });
}

/**
 * Forks N renter minions into child processes
 * @private
 * @returns {Array}
 */
RenterPool.prototype._forkMinions = function() {
  let self = this;
  let minions = {};

  this._options.forEach(function(config) {
    log.info('forking renter minion process');

    let nodeId = storj.KeyPair(config.privkey).getNodeID();
    let minion = childproc.fork('./bin/minion.js', [JSON.stringify(config)], {
      stdio: 'inherit'
    });

    self._setupIpcListeners(nodeId, minion);

    minions[nodeId] = minion;
  });

  return minions;
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

  console.log(proc);
};

/**
 * Replaces the minion with a new instance
 * @private
 * @param {String} nodeId
 */
RenterPool.prototype._replaceMinion = function(nodeId) {
  this._minions[nodeId].kill();

  for (let opts in this._options) {
    if (storj.KeyPair(this._options[opts].privkey).getNodeID() === nodeId) {
      let minion = childproc.fork('./bin/minion.js', [
        JSON.stringify(this._options[opts])
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

  this._pendingCallbacks[message.id].apply(this,
    message.error ?
    [new Error(message.error.message)] :
    [null].concat(message.result)
  );

  delete this._pendingCallbacks[message.id];
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
  this._pendingCallbacks[id] = callback;

  proc.send({
    id: id,
    method: method,
    params: params
  });
};

module.exports = RenterPool;
