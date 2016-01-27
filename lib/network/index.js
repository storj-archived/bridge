/**
 * @class metadisk/network
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const async = require('async');
const kad = require('kad');
const spartacus = require('kad-spartacus');
const stream = require('readable-stream');
const through = require('through');

const MetaDiskContact = spartacus.ContactDecorator(
  kad.contacts.AddressPortContact
);

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

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

  this._transport = kad.transports.TCP(this._contact, { logger: logger });

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
  callback(key === sha256(sha256(value)));
};

/**
 * Returns a readable stream of file chunks as they become available
 * #createReadStream
 * @param {Object} pointer
 * @param {String} pointer.hash
 * @param {Array} pointer.shards
 */
Network.prototype.createReadStream = function(pointer) {
  let self = this;
  let limit = 4;
  let allTasks = pointer.shards.map(function(hash) {
    return function getShard(callback) {
      self._dht.get(hash, callback);
    };
  });
  let lastTasks = [];
  let remainder = allTasks.length % limit;

  for (let i = 0; i < remainder; i++) {
    lastTasks.push(allTasks.pop());
  }

  let tasks = [];

  while (allTasks.length > 0) {
    tasks.push(allTasks.splice(0, limit));
  }

  tasks.push(lastTasks);

  function getFileSlice(taskSet, callback) {
    async.parallel(taskSet, function(err, results) {
      if (err) {
        return callback(err);
      }

      callback(null, Buffer.concat(results.map(function(jsonbuf) {
        return JSON.parse(jsonbuf, function(key, value) {
          return value && value.type === 'Buffer' ?
            new Buffer(value.data) :
            value;
        });
      })));
    });
  }

  var readable = new stream.Readable({
    read: function() {
      let self = this;
      let taskset = tasks.splice(0, 4).reduce(function(a, b) {
        return a.concat(b);
      }, []);

      if (!taskset.length) {
        return self.push(null);
      }

      getFileSlice(taskset, function(err, fileSlice) {
        if (err) {
          return readable.emit('error', err);
        }

        self.push(fileSlice);
      });
    }
  });

  return readable;
};

/**
 * Returns a transform stream for storing a file in the network
 * #createTransferStream
 */
Network.prototype.createTransferStream = function() {
  let self = this;

  let transform = through(
    function onData(data) {
      let chunk = JSON.stringify(data);
      let key = sha256(sha256(chunk));

      transform.pause();

      self._dht.put(key, chunk, function(err) {
        if (err) {
          return transform.emit('error', err);
        }

        transform.emit('data', key);
        transform.resume();
      });
    },
    function onEnd() {
      this.emit('end');
    }
  );

  return transform;
};

module.exports = Network;
