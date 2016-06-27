'use strict';

const async = require('async');
const log = require('./logger');
const amqplib = require('amqplib/callback_api');
const EventEmitter = require('events').EventEmitter;
const inherits = require('util').inherits;


function Messaging(options) {
  if (!(this instanceof Messaging)) {
    return new Messaging(options);
  }

  this._options = options || {
    url: 'amqp://localhost'
  };
  this._connection = null;
  this.channels = {};
  this.queues = {};
  this.exchanges = {};

  EventEmitter.call(this);
}

inherits(Messaging, EventEmitter);

Messaging.prototype._connect = function start(callback) {
  log.debug('Connecting to: %s', this._options.url);
  amqplib.connect(this._options.url, (err, connection) => {
    if (err) {
      log.error(`Error connecting to %s: %s`, this._options.url, err.message);
      return callback(err);
    }
    this._connection = connection;
    callback();
  });
};

Messaging.prototype._openChannels = function openChannels(callback) {
  if (!this._connection) { return callback(new Error('Not connected')); }
  log.debug('Opening messaging channels');
  async.each(['serial', 'parallel'], (channelName, next) => {
    this._connection.createChannel((err, channel) => {
      if (err) {
        log.error(`Error creating channel to %s: %s`, channelName, err.message);
        return next(err);
      }
      if (channelName === 'serial') {
        channel.prefetch = 1;
      }
      this.channels[channelName] = channel;
      next();
    });
  }, callback);
};

Messaging.prototype._openQueues = function openQueues(callback) {
  if (!this.channels || !this.channels.parallel) { return callback(new Error('Not connected')); }
  log.debug('Opening messaging queues');
  async.each(Object.keys(this._options.queues), (key, next) => {
    this.channels.parallel.assertQueue(
      this._options.queues[key].name,
      this._options.queues[key].options,
      (err, q) => {
        if (err) { return next(err); }
        this.queues[key] = q.queue;
        next();
      }
    );
  }, callback);
};

Messaging.prototype._openExchanges = function openExchanges(callback) {
  if (!this.channels || !this.channels.parallel) { return callback(new Error('Not connected')); }
  log.debug('Opening messaging exchanges');
  async.each(Object.keys(this._options.exchanges), (key, next) => {
    this.channels.parallel.assertExchange(
      this._options.exchanges[key].name,
      this._options.exchanges[key].type,
      this._options.exchanges[key].options,
      (err, ex) => {
        if (err) { return next(err); }
        this.exchanges[key] = ex;
        next();
      }
    );
  }, callback);
};

Messaging.prototype._listenForReplies = function listenForReplies(callback) {
  log.info(`listening for messages on callback queue: ${this.queues.callback}`);
  this.channels.parallel.consume(
    this.queues.callback,
    (msg) => {
      log.debug(`Got message, emitting`);
      this.emit('message', msg);
    },
    {noAck: true},
    callback
  );
};

Messaging.prototype._listenForWork = function listenForReplies(callback) {
  log.info(`listening for messages on work queue: ${this.queues.renterpool}`);
  this.channels.serial.consume(
    this.queues.renterpool,
    (msg) => {
      this.emit('work', msg);
    },
    {noAck: false},
    callback
  );
};

Messaging.prototype.start = function start(worker, callback) {
  log.info('starting messaging');
  if (typeof worker === 'function') {
    callback = worker;
    worker = false;
  }
  async.series([
    (next) => {
      this._connect(next);
    },
    (next) => {
      this._connect(next);
    },
    (next) => {
      this._openChannels(next);
    },
    (next) => {
      this._openQueues(next);
    },
    (next) => {
      this._openExchanges(next);
    },
    (next) => {
      this._listenForReplies(next);
    },
    (next) => {
      if (worker) {
        return this._listenForWork(next);
      }
      next();
    }
  ], callback);
};

Messaging.prototype.send = function send(message, queue, options) {
  let channelName = 'parallel';
  if (!this.channels || !this.channels[channelName]) {
    log.error(`Could not send message on channel ${channelName}`);
    return false;
  }
  log.info(`Sending message to ${queue}`);
  return this.channels[channelName].sendToQueue(
    queue,
    new Buffer(message),
    options
  );
};

Messaging.prototype.publish = function publish(topic, message) {
  return this.channels.parallel.publish(
    this.exchanges.events.exchange,
    topic,
    new Buffer(message)
  );
};

Messaging.prototype.subscribe = function subscribe(topic, callback) {
  log.info(`Subscribing to ${topic} messages on ${this._options.exchanges.events.name}`);
  this.channels.parallel.bindQueue(
    this.queues.callback,
    this._options.exchanges.events.name,
    topic,
    callback
  );
};

module.exports = Messaging;
