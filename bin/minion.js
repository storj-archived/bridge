'use strict';

const storj = require('storj');
const logger = require('../lib/logger');
const Storage = require('../lib/storage');
const MongoAdapter = require('../lib/storage/adapter');
const Config = require('../lib/config');
const config = Config(process.env.NODE_ENV || 'devel');
const storage = Storage(config.storage);
const options = JSON.parse(process.argv[2]);

let adapter = new MongoAdapter(storage);
let manager = new storj.Manager(adapter);

storage.models.Contact.recall(3, function(err, seeds) {
  if (err) {
    logger.error(err);
    process.exit();
  }

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

  network.join(function(err) {
    if (err) {
      logger.error(err.message);
      process.exit();
    }
  });

  process.on('message', function(message) {
    message.params.push(function(err) {
      if (err) {
        return process.send({
          id: message.id,
          error: {
            message: err.message
          }
        });
      }

      let args = Array.prototype.slice.call(arguments);

      args.shift();
      process.send({ id: message.id, result: args });
    });

    network[message.method].apply(network, message.params);
  });
});
