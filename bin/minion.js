'use strict';

const storj = require('storj');
const logger = require('../lib/logger');
const Storage = require('../lib/storage');
const MongoAdapter = require('../lib/storage/adapter');
const Config = require('../lib/config');
const config = Config(process.env.NODE_ENV || 'devel');

if (process.env.NODE_ENV === 'devel') {
  config.storage.name = '__storj-bridge-develop';
}

const storage = Storage(config.storage);
const options = JSON.parse(process.argv[2]);

let adapter = new MongoAdapter(storage);
let manager = new storj.Manager(adapter);

function _castArguments(message) {
  switch (message.method) {
    case 'getStorageOffer':
      message.params[0] = storj.Contract.fromObject(message.params[0]);
      break;
    case 'getStorageProof':
      message.params[0] = storj.Contact(message.params[0]);
      message.params[1] = storj.StorageItem(message.params[1]);
      break;
    case 'getRetrieveToken':
      message.params[0] = storj.Contact(message.params[0]);
      message.params[1] = storj.Contract.fromObject(message.params[1]);
      break;
    case 'getConsignToken':
      message.params[0] = storj.Contact(message.params[0]);
      message.params[1] = storj.Contract.fromObject(message.params[1]);
      message.params[2] = storj.AuditStream.fromRecords(
        message.params[2].challenges,
        message.params[2].tree
      );
      break;
    default:
      // noop
  }
}

storage.models.Contact.recall(3, function(err, seeds) {
  if (err) {
    logger.error(err);
    process.exit();
  }

  console.log(options)

  let network = storj.RenterInterface({
    keypair: storj.KeyPair(options.privkey),
    manager: manager,
    logger: logger,
    seeds: seeds.map(function(seed) {
      return seed.toString();
    }),
    address: options.address,
    port: options.port,
    tunnels: options.tunnels,
    noforward: true,
    tunport: options.tunport,
    gateways: options.gateways
  });

  network._router.on('add', function(contact) {
    storage.models.Contact.record(contact);
  });

  network._router.on('shift', function(contact) {
    storage.models.Contact.record(contact);
  });

  network._getConnectedContacts = function(callback) {
    let connected = [];

    for (var index in this._router._buckets) {
      connected = connected.concat(
        this._router._buckets[index].getContactList()
      );
    }

    callback(null, connected);
  };

  network.join(function(err) {
    if (err) {
      logger.error(err.message);
      process.exit();
    }

    process.send('ready');
  });

  process.on('message', function(message) {
    message.params.push(function() {
      if (arguments[0] instanceof Error) {
        return process.send({
          id: message.id,
          error: {
            message: arguments[0].message
          }
        });
      }

      let args = Array.prototype.slice.call(arguments);

      process.send({ id: message.id, result: args });
    });

    _castArguments(message);
    network[message.method].apply(network, message.params);
  });
});
