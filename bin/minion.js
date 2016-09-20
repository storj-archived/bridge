'use strict';

const storj = require('storj');
const logger = require('../lib/logger');
const Storage = require('../lib/storage');
const MongoAdapter = require('../lib/storage/adapter');
const Config = require('../lib/config');
const config = Config(process.env.NODE_ENV || 'develop');
const Messaging = require('../lib/messaging');
const messaging = new Messaging(config.messaging);
const CONSTANTS = require('../lib/constants');

if (process.env.NODE_ENV === 'develop') {
  config.storage.name = '__storj-bridge-develop';
}

const storage = Storage(config.storage);
const options = JSON.parse(process.argv[2]);

const keypair = storj.KeyPair(options.privkey);
const nodeId = keypair.getNodeID();

logger.info('[minion] started with %s', nodeId);

let adapter = new MongoAdapter(storage);
let manager = new storj.StorageManager(adapter);

function _castArguments(message) {
  let contract;
  switch (message.method) {
    case 'getStorageOffer':
      contract = storj.Contract.fromObject(message.params[0]);
      contract.set('renter_id', nodeId);
      contract.sign('renter', keypair.getPrivateKey());
      message.params[0] = contract;
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
    case 'getMirrorNodes':
      message.params[0] = message.params[0].map(function(obj) {
        return storj.DataChannelPointer(
          storj.Contact(obj.farmer),
          obj.hash,
          obj.token,
          obj.operation
        );
      });
      message.params[1] = message.params[1].map(function(obj) {
        return storj.Contact(obj);
      });
      break;
    default:
      // noop
  }
}

function handleError(err) {
  if (err) {
    logger.error(`[minion] ${err.message}`);
    process.exit();
  }
}

const worker = true;

messaging.start(worker, (err) => {
  handleError(err);

  let level;

  if (process.env.NODE_ENV === 'test') {
    level = CONSTANTS.LOG_LEVEL_NONE;
  } else {
    level = config.logger.minionLevel;
  }

  let logger = Logger(level);

  if (level) {
    logger.pipe(process.stdout);
  }

  storage.models.Contact.recall(3, function(err, seeds) {
    handleError(err);

    let network = storj.RenterInterface({
      keypair: storj.KeyPair(options.privkey),
      manager: manager,
      logger: logger,
      seeds: seeds.map(function(seed) {
        return seed.toString();
      }),
      bridge: false,
      address: options.address,
      port: options.port,
      tunnels: options.tunnels,
      noforward: true,
      tunport: options.tunport,
      gateways: options.gateways
    });

    network.router.on('add', function(contact) {
      storage.models.Contact.record(contact);
    });

    network.router.on('shift', function(contact) {
      storage.models.Contact.record(contact);
    });

    network._getConnectedContacts = function(callback) {
      let connected = [];

      for (var index in this.router._buckets) {
        connected = connected.concat(
          this.router._buckets[index].getContactList()
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

    network.on('unhandledOffer', (contract, contact) => {
      logger.debug('[minion] got unhandledOffer. Relaying.');
      messaging.publish('minion.relay', JSON.stringify({contract: contract.toObject(), contact: contact}));
    });

    messaging.subscribe('minion.relay');

    messaging.on('minion.relay', (msg) => {
      logger.info('[minion] recieved relay message from %s', msg.properties.replyTo);
      const message = JSON.parse(msg.content);
      const contract = storj.Contract.fromObject(message.contract);
      const contact = storj.Contact(message.contact);
      if (network._pendingContracts[contract.get('data_hash')]) {
        network._pendingContracts[contract.get('data_hash')](contact, contract);
        delete network._pendingContracts[contract.get('data_hash')];
      }
    });

    messaging.on('work', function(msg) {
      messaging.channels.serial.ack(msg);
      const message = JSON.parse(msg.content);
      logger.info('[minion] got work on %s %s', messaging.queues.renterpool, msg.properties.messageId);

      message.params.push(function() {
        logger.info('[minion] got network reply to %s', msg.properties.messageId);

        if (arguments[0] instanceof Error) {
          logger.info('[minion] sending error message to %s: %s', msg.properties.replyTo, arguments[0].message);
          return messaging.send(
            JSON.stringify({ error: { message: arguments[0].message } }),
            msg.properties.replyTo,
            { correlationId: msg.properties.messageId }
          );
        }

        let args = Array.prototype.slice.call(arguments);
        for (let i = 0; i < args.length; i++) {
          try {
            if (typeof args[i] !== 'function') {
              args[i] = args[i].toObject();
            }
          } catch (e) {}
        }

        logger.info('[minion] sending message to %s', msg.properties.replyTo);
        messaging.send(
          JSON.stringify({result: args}),
          msg.properties.replyTo,
          { correlationId: msg.properties.messageId }
        );
      });

      _castArguments(message);
      logger.info('[minion] calling network %s', message.method);
      network[message.method].apply(network, message.params);
    });
  });
});
