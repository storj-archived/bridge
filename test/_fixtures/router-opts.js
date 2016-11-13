'use strict';

var proxyquire = require('proxyquire');
var mongoose = require('mongoose');
var sinon = require('sinon');

require('mongoose-currency').loadType(mongoose);
require('mongoose-types').loadTypes(mongoose);
sinon.stub(mongoose, 'createConnection').returns(
  new mongoose.Connection(new mongoose.Mongoose())
);

const Config = require('../../lib/config');
const Storage = proxyquire('storj-service-storage-models', {
  mongoose: mongoose
});
const Network = require('storj-complex').createClient;
const Mailer = require('storj-service-mailer');
const MongoDBAdapter = proxyquire('storj-mongodb-adapter', {
  mongoose: mongoose
});
const StorageManager = require('storj-lib').StorageManager;

var config = new Config('__tmptest');
var storage = new Storage(config.storage, {});
var network = new Network(config.complex);
var mailer = new Mailer(config.mailer);
var contracts = new StorageManager(
  new MongoDBAdapter(storage.connection)
);

module.exports = {
  network: network,
  config: config,
  contracts: contracts,
  storage: storage,
  mailer: mailer
};
