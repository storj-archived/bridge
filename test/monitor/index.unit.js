'use strict';

const fs = require('fs');
const sinon = require('sinon');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Storage = require('storj-service-storage-models');
const ComplexClient = require('storj-complex').createClient;
const storj = require('storj-lib');
const Monitor = require('../../lib/monitor');
const MonitorConfig = require('../../lib/monitor/config');
const log = require('../../lib/logger');

/* jshint maxstatements: 100 */

describe('Monitor', function() {

  const sandbox = sinon.sandbox.create();
  beforeEach(() => {
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'writeFileSync');
    sandbox.stub(fs, 'readFileSync').returns('{}');
  });
  afterEach(() => sandbox.restore());

  const config = new MonitorConfig('/tmp/storj-monitor-test.json');

  describe('@constructor', function() {

    it('will contruct with new', function() {
      const monitor = new Monitor(config);
      expect(monitor._config).to.equal(config);
      expect(monitor._timeout).to.equal(null);
      expect(monitor._running).to.equal(false);
    });

    it('will contruct without new', function() {
      const monitor = Monitor(config);
      expect(monitor._config).to.equal(config);
      expect(monitor._timeout).to.equal(null);
      expect(monitor._running).to.equal(false);
    });

  });

  describe('#start', function() {

    it('will init storage, network, contracts, and schedule run', function(done) {
      const monitor = new Monitor(config);
      monitor.wait = sandbox.stub();
      monitor.start(function(err) {
        if (err) {
          return done(err);
        }
        expect(monitor.storage).to.be.instanceOf(Storage);
        expect(monitor.network).to.be.instanceOf(ComplexClient);
        expect(monitor.contracts).to.be.instanceOf(storj.StorageManager);
        expect(monitor.wait.callCount).to.equal(1);
        done();
      });
    });

  });

  describe('@sortByTimeoutRate', function() {
    it('will sort with the best timeout rate (0) at top', function() {
      const mirrors = [{
        contact: { timeoutRate: 0.99 }
      }, {
        contact: { timeoutRate: 0.03 }
      }, {
        contact: { }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 1 }
      }, {
        contact: { timeoutRate: 0 }
      }];

      mirrors.sort(Monitor.sortByTimeoutRate);

      expect(mirrors).to.eql([{
        contact: { }
      }, {
        contact: { timeoutRate: 0 }
      }, {
        contact: { timeoutRate: 0.03 }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 0.99 }
      }, {
        contact: { timeoutRate: 1 }
      }]);
    });
  });

  describe('#_fetchDestinations', function() {
    it('it will filter and sort mirrors', function(done) {
      sandbox.spy(Monitor, 'sortByTimeoutRate');
      const monitor = new Monitor(config);
      const results = [
        {},
        {
          contact: {
            _id: '3cc349ea3b302fb953b4dde04f99af23fe4a849b',
            timeoutRate: 0.001
          },
          isEstablished: false
        },
        {
          contact: {
            _id: '8e744f9ece61fbfc6a22061678f66eea76d67690',
            timeoutRate: 0.01
          },
          isEstablished: false
        },
        {
          contact: {
            _id: '1d66d28271270ee56d5914d9282756b3968592ee'
          },
          isEstablished: true
        },
        {
          contact: {
            _id: '1f22ab4bddee4f7ba918277b346cf20df3592b4b'
          },
          isEstablished: false
        }
      ];
      const exec = sandbox.stub().callsArgWith(0, null, results);
      const populate = sandbox.stub().returns({exec: exec});
      const find = sandbox.stub().returns({populate: populate});
      monitor.storage = {
        models: {
          Mirror: {
            find: find
          }
        }
      };
      const shard = {
        hash: '1aa3af35db376b56545d16155f1ceb49b3a4a7c3',
        contracts: {
          '1f22ab4bddee4f7ba918277b346cf20df3592b4b': {}
        }
      };
      monitor._fetchDestinations(shard, (err, mirrors) => {
        if (err) {
          return done(err);
        }
        expect(populate.callCount).to.equal(1);
        expect(find.callCount).to.equal(1);
        expect(find.args[0][0].shardHash).to.equal(shard.hash);
        expect(exec.callCount).to.equal(1);
        expect(mirrors.length).to.equal(2);
        expect(mirrors[0].isEstablished).to.equal(false);
        expect(mirrors[0].contact.timeoutRate).to.equal(0.001);
        expect(Monitor.sortByTimeoutRate.callCount).to.equal(1);
        done();
      });
    });
    it('it will give error on query failure', function(done) {
      const monitor = new Monitor(config);
      const exec = sandbox.stub().callsArgWith(0, new Error('test'));
      const populate = sandbox.stub().returns({exec: exec});
      const find = sandbox.stub().returns({populate: populate});
      monitor.storage = {
        models: {
          Mirror: {
            find: find
          }
        }
      };
      const shard = {
        hash: '1aa3af35db376b56545d16155f1ceb49b3a4a7c3',
        contracts: {}
      };
      monitor._fetchDestinations(shard, (err) => {
        expect(err).to.be.instanceOf(Error);
        done();
      });
    });
  });

  describe('#_fetchSources', function() {
    it('it will query and sort contacts', function(done) {
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      const results = [{
        toObject: sandbox.stub().returns({
          address: '127.0.0.2',
          port: 10002
        })
      }, {
        toObject: sandbox.stub().returns({
          address: '127.0.0.1',
          port: 10001
        })
      }, {
        toObject: sandbox.stub().returns({}) // invalid contact
      }];
      const exec = sandbox.stub().callsArgWith(0, null, results);
      const sort = sandbox.stub().returns({exec: exec});
      const find = sandbox.stub().returns({sort: sort});
      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };
      const shard = {
        contracts: {
          'farmer1': {},
          'farmer2': {}
        }
      };

      monitor._fetchSources(shard, (err, contacts) => {
        if (err) {
          return done(err);
        }
        expect(find.callCount).to.equal(1);
        expect(find.args[0][0]._id.$in).to.eql(['farmer1', 'farmer2']);
        expect(sort.callCount).to.equal(1);
        expect(sort.args[0][0].lastSeen).to.equal(-1);
        expect(exec.callCount).to.equal(1);
        expect(contacts.length).to.equal(2);
        expect(contacts[0]).to.be.instanceOf(storj.Contact);
        expect(contacts[1]).to.be.instanceOf(storj.Contact);
        expect(contacts[0].address).to.equal('127.0.0.2');
        expect(contacts[0].port).to.equal(10002);
        done();
      });
    });
    it('it will query and sort contacts', function(done) {
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      const exec = sandbox.stub().callsArgWith(0, new Error('test'));
      const sort = sandbox.stub().returns({exec: exec});
      const find = sandbox.stub().returns({sort: sort});
      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };
      const shard = {
        contracts: {
          'farmer1': {},
          'farmer2': {}
        }
      };

      monitor._fetchSources(shard, (err) => {
        expect(err).to.be.instanceOf(Error);
        done();
      });
    });
  });

  describe('#_saveShard', function() {
    it('it will add contract, save shard and update mirror', function(done) {
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      monitor.contracts = {
        save: sandbox.stub().callsArgWith(1, null)
      };
      const shard = {
        addContract: sandbox.stub()
      };
      const destination = {
        save: sandbox.stub().callsArgWith(0, null),
        contact: {
          address: '127.0.0.1',
          port: 10000
        },
        contract: {}
      };
      monitor._saveShard(shard, destination, (err) => {
        if (err) {
          return done(err);
        }
        expect(shard.addContract.callCount).to.equal(1);
        expect(shard.addContract.args[0][0]).to.be.instanceOf(storj.Contact);
        expect(shard.addContract.args[0][1]).to.be.instanceOf(storj.Contract);
        expect(monitor.contracts.save.callCount).to.equal(1);
        expect(destination.save.callCount).to.equal(1);
        expect(log.error.callCount).to.equal(0);
        expect(destination.isEstablished).to.equal(true);
        done();
      });
    });
    it('it will give error while saving contract', function(done) {
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      monitor.contracts = {
        save: sandbox.stub().callsArgWith(1, new Error('test'))
      };
      const shard = {
        addContract: sandbox.stub()
      };
      const destination = {
        save: sandbox.stub().callsArgWith(0, null),
        contact: {
          address: '127.0.0.1',
          port: 10000
        },
        contract: {}
      };
      monitor._saveShard(shard, destination, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(monitor.contracts.save.callCount).to.equal(1);
        expect(destination.save.callCount).to.equal(0);
        done();
      });

    });
    it('it give error while saving mirror', function(done) {
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      monitor.contracts = {
        save: sandbox.stub().callsArgWith(1, null)
      };
      const shard = {
        addContract: sandbox.stub()
      };
      const destination = {
        save: sandbox.stub().callsArgWith(0, new Error('test')),
        contact: {
          address: '127.0.0.1',
          port: 10000
        },
        contract: {}
      };
      monitor._saveShard(shard, destination, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(monitor.contracts.save.callCount).to.equal(1);
        expect(destination.save.callCount).to.equal(1);
        done();
      });
    });
  });

  describe('#_transferShard', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('will handle an invalid contract', function(done) {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      sandbox.stub(storj, 'Contract').throws(new Error('Invalid contract'));
      const monitor = new Monitor(config);
      monitor._saveShard = sinon.stub();
      monitor.network = {
        getRetrievalPointer: sinon.stub().callsArg(2)
      };
      const shard = {};
      const contact = storj.Contact({
        address: '127.0.0.1',
        port: 100000
      });
      const mirror = {
        contract: {}
      };
      const state = {
        sources: [contact],
        destinations: [mirror]
      };
      sandbox.spy(monitor, '_transferShard');
      monitor._transferShard(shard, state, (err) => {
        expect(log.warn.callCount).to.equal(1);
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Destinations exhausted');
        expect(monitor._transferShard.callCount).to.equal(2);
        done();
      });
    });

    it('will handle error pointer, shift source, and try again', function(done) {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      const monitor = new Monitor(config);
      monitor._saveShard = sinon.stub();
      monitor.network = {
        getRetrievalPointer: sinon.stub().callsArgWith(2, new Error('test'))
      };
      const contract = new storj.Contract();
      const shard = {
        getContract: sandbox.stub().returns(contract)
      };
      const contact = storj.Contact({
        address: '127.0.0.1',
        port: 100000
      });
      const mirror = {
        contract: {}
      };
      const state = {
        sources: [contact],
        destinations: [mirror]
      };
      sandbox.spy(monitor, '_transferShard');
      monitor._transferShard(shard, state, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Sources exhausted');
        expect(monitor.network.getRetrievalPointer.callCount)
          .to.equal(1);
        expect(monitor.network.getRetrievalPointer.args[0][0])
          .to.equal(contact);
        expect(monitor.network.getRetrievalPointer.args[0][1])
          .to.be.instanceOf(storj.Contract);
        expect(monitor.network.getRetrievalPointer.args[0][1])
          .to.equal(contract);
        expect(log.warn.callCount).to.equal(1);
        expect(monitor._transferShard.callCount).to.equal(2);
        expect(monitor._saveShard.callCount).to.equal(0);
        done();
      });
    });

    it('will handle mirror error, shift dest., and try again', function(done) {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      const monitor = new Monitor(config);
      monitor._saveShard = sinon.stub();
      const pointer = {};
      monitor.network = {
        getRetrievalPointer: sinon.stub().callsArgWith(2, null, pointer),
        getMirrorNodes: sinon.stub().callsArgWith(2, new Error('timeout'))
      };
      const contract = new storj.Contract();
      const shard = {
        getContract: sandbox.stub().returns(contract)
      };
      const contact = storj.Contact({
        address: '127.0.0.1',
        port: 100000
      });
      const mirror = {
        contract: {},
        contact: {
          address: '128.0.0.1',
          port: 100000
        }
      };
      const state = {
        sources: [contact],
        destinations: [mirror]
      };
      sandbox.spy(monitor, '_transferShard');
      monitor._transferShard(shard, state, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Destinations exhausted');
        expect(monitor.network.getMirrorNodes.callCount)
          .to.equal(1);
        expect(monitor.network.getMirrorNodes.args[0][0][0])
          .to.equal(pointer);
        expect(monitor.network.getMirrorNodes.args[0][1][0])
          .to.be.instanceOf(storj.Contact);
        expect(log.warn.callCount).to.equal(1);
        expect(monitor._transferShard.callCount).to.equal(2);
        expect(monitor._saveShard.callCount).to.equal(0);
        done();
      });

    });

    it('will save shard updated with new contract', function(done) {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'warn');
      const monitor = new Monitor(config);
      monitor._saveShard = sinon.stub().callsArg(2);
      const pointer = {};
      monitor.network = {
        getRetrievalPointer: sinon.stub().callsArgWith(2, null, pointer),
        getMirrorNodes: sinon.stub().callsArgWith(2, null, {})
      };
      const contract = new storj.Contract();
      const shard = {
        getContract: sandbox.stub().returns(contract)
      };
      const contact = storj.Contact({
        address: '127.0.0.1',
        port: 100000
      });
      const mirror = {
        contract: {},
        contact: {
          address: '128.0.0.1',
          port: 100000
        }
      };
      const state = {
        sources: [contact],
        destinations: [mirror]
      };
      sandbox.spy(monitor, '_transferShard');
      monitor._transferShard(shard, state, (err) => {
        if (err) {
          return done(err);
        }
        expect(log.error.callCount).to.equal(0);
        expect(log.warn.callCount).to.equal(0);
        expect(monitor._transferShard.callCount).to.equal(1);
        expect(monitor._saveShard.callCount).to.equal(1);
        expect(monitor._saveShard.args[0][0]).to.equal(shard);
        expect(monitor._saveShard.args[0][1]).to.equal(state.destinations[0]);
        done();
      });

    });

  });

  describe('#_replicateShard', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('it will fetch sources and destinations', function(done) {
      const monitor = new Monitor(config);
      monitor._transferShard = sinon.stub().callsArg(2);
      const destinations = [];
      const sources = [];
      monitor._fetchDestinations = sinon.stub()
        .callsArgWith(1, null, destinations);
      monitor._fetchSources = sinon.stub().callsArgWith(1, null, sources);
      const shard = {};
      monitor._replicateShard(shard, (err) => {
        if (err) {
          return done(err);
        }
        expect(monitor._transferShard.callCount).to.equal(1);
        expect(monitor._transferShard.args[0][0]).to.equal(shard);
        expect(monitor._transferShard.args[0][1]).to.eql({
          sources: [],
          destinations: []
        });
        done();
      });
    });

    it('it will handle error from queries', function(done) {
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      monitor._transferShard = sinon.stub().callsArg(2);
      const destinations = [];
      monitor._fetchDestinations = sinon.stub()
        .callsArgWith(1, null, destinations);
      monitor._fetchSources = sinon.stub().callsArgWith(1, new Error('test'));
      const shard = {};
      monitor._replicateShard(shard, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('test');
        done();
      });
    });
  });

  describe('#_replicateFarmer', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('it will log on error', function(done) {
      sandbox.stub(log, 'info');
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      const cursor = new EventEmitter();
      const nodeID = '353ba728e2d74826c2fcbf5ada2fe1c402e3eda1';
      monitor.storage = {
        models: {
          Shard: {
            find: sandbox.stub().returns({
              cursor: sandbox.stub().returns(cursor)
            })
          }
        }
      };
      const contact = {
        nodeID: nodeID
      };
      monitor._replicateFarmer(contact);
      cursor.on('error', () => {
        expect(log.info.callCount).to.equal(1);
        expect(log.error.callCount).to.equal(1);
        expect(log.error.args[0][1]).to.equal(nodeID);
        expect(log.error.args[0][2]).to.equal('test');
        done();
      });
      cursor.emit('error', new Error('test'));
    });

    it('will call replicateShard for each data item', function(done) {
      sandbox.stub(log, 'info');
      const monitor = new Monitor(config);
      const cursor = new EventEmitter();
      cursor.pause = sandbox.stub();
      cursor.resume = sandbox.stub();
      monitor.storage = {
        models: {
          Shard: {
            find: sandbox.stub().returns({
              cursor: sandbox.stub().returns(cursor)
            })
          }
        }
      };
      const data = {
        toObject: sandbox.stub().returns({
          hash: '03780c65a61ebe7334e9ff2a9267a9d725fc2d4b'
        })
      };
      const contact = {
        nodeID: '353ba728e2d74826c2fcbf5ada2fe1c402e3eda1'
      };
      monitor._replicateShard = sinon.stub().callsArg(1);
      monitor._replicateFarmer(contact);
      cursor.on('data', () => {
        expect(log.info.callCount).to.equal(2);
        expect(monitor._replicateShard.callCount).to.equal(1);
        expect(monitor._replicateShard.args[0][0])
          .to.be.instanceOf(storj.StorageItem);
        expect(monitor._replicateShard.args[0][0].hash)
          .to.equal('03780c65a61ebe7334e9ff2a9267a9d725fc2d4b');
        expect(data.toObject.callCount).to.equal(1);
        expect(cursor.pause.callCount).to.equal(1);
        expect(cursor.resume.callCount).to.equal(1);
        done();
      });
      cursor.emit('data', data);
    });

    it('will log error from replicate shard', function(done) {
      sandbox.stub(log, 'info');
      sandbox.stub(log, 'error');
      const monitor = new Monitor(config);
      const cursor = new EventEmitter();
      cursor.pause = sandbox.stub();
      cursor.resume = sandbox.stub();
      monitor.storage = {
        models: {
          Shard: {
            find: sandbox.stub().returns({
              cursor: sandbox.stub().returns(cursor)
            })
          }
        }
      };
      const data = {
        toObject: sandbox.stub().returns({
          hash: '03780c65a61ebe7334e9ff2a9267a9d725fc2d4b'
        })
      };
      const contact = {
        nodeID: '353ba728e2d74826c2fcbf5ada2fe1c402e3eda1'
      };
      monitor._replicateShard = sinon.stub().callsArgWith(1, new Error('test'));
      monitor._replicateFarmer(contact);
      cursor.on('data', () => {
        expect(log.info.callCount).to.equal(2);
        expect(monitor._replicateShard.callCount).to.equal(1);
        expect(monitor._replicateShard.args[0][0])
          .to.be.instanceOf(storj.StorageItem);
        expect(monitor._replicateShard.args[0][0].hash)
          .to.equal('03780c65a61ebe7334e9ff2a9267a9d725fc2d4b');
        expect(data.toObject.callCount).to.equal(1);
        expect(cursor.pause.callCount).to.equal(1);
        expect(cursor.resume.callCount).to.equal(1);
        expect(log.error.callCount).to.equal(1);
        expect(log.error.args[0][1])
          .to.equal('03780c65a61ebe7334e9ff2a9267a9d725fc2d4b');
        expect(log.error.args[0][2])
          .to.equal('test');
        done();
      });
      cursor.emit('data', data);
    });

    it('it will log on close', function(done) {
      sandbox.stub(log, 'info');
      const monitor = new Monitor(config);
      const cursor = new EventEmitter();
      monitor.storage = {
        models: {
          Shard: {
            find: sandbox.stub().returns({
              cursor: sandbox.stub().returns(cursor)
            })
          }
        }
      };
      const contact = {
        nodeID: '353ba728e2d74826c2fcbf5ada2fe1c402e3eda1'
      };
      monitor._replicateFarmer(contact);
      cursor.on('close', () => {
        expect(log.info.callCount).to.equal(2);
        done();
      });
      cursor.emit('close');
    });
  });

  describe('#run', function() {

    it('will call wait if already running', function() {
      const monitor = new Monitor(config);
      monitor._running = true;
      monitor.wait = sandbox.stub();
      monitor.run();
      expect(monitor.wait.callCount).to.equal(1);
    });


    it('will log error when querying contacts', function() {
      const monitor = new Monitor(config);

      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');


      const exec = sandbox.stub().callsArgWith(0, new Error('Mongo error'));
      const sort = sandbox.stub().returns({
        exec: exec
      });
      const limit = sandbox.stub().returns({
        sort: sort
      });
      const find = sandbox.stub().returns({
        limit: limit
      });

      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };

      monitor.wait = sandbox.stub();
      monitor.run();
      expect(monitor.wait.callCount).to.equal(1);
      expect(monitor._running).to.equal(false);
      expect(log.error.callCount).to.equal(1);
      expect(log.info.callCount).to.equal(2);
    });

    it('will log error when missing contacts', function() {
      const monitor = new Monitor(config);

      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');


      const exec = sandbox.stub().callsArgWith(0, null, null);
      const sort = sandbox.stub().returns({
        exec: exec
      });
      const limit = sandbox.stub().returns({
        sort: sort
      });
      const find = sandbox.stub().returns({
        limit: limit
      });

      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };

      monitor.wait = sandbox.stub();
      monitor.run();
      expect(monitor.wait.callCount).to.equal(1);
      expect(monitor._running).to.equal(false);
      expect(log.error.callCount).to.equal(1);
      expect(log.info.callCount).to.equal(2);
    });

    it('query least seen contacts, log and record status', function() {
      const monitor = new Monitor(config);

      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');
      sandbox.stub(log, 'warn');

      monitor.network = {
        ping: sandbox.stub().callsArgWith(1, new Error('Farmer offline'))
      };
      monitor.network.ping.onThirdCall().callsArgWith(1, null);

      const save = sandbox.stub().callsArg(0);
      save.onSecondCall().callsArgWith(0, new Error('Mongo error'));

      const recordTimeoutFailure = sandbox.stub().returns({
        save: save
      });

      const contacts = [{
        nodeID: '7b8b30132e930c7827ee47efebfb197d6a3246d4',
        address: '127.0.0.1',
        port: 1337,
        recordTimeoutFailure: recordTimeoutFailure,
        timeoutRate: 0.05
      }, {
        nodeID: 'dd985ca22f19858257b3328a56f8f4aabee1d4a1',
        address: '127.0.0.1',
        port: 1337,
        recordTimeoutFailure: recordTimeoutFailure,
        timeoutRate: 0.02
      }, {
        nodeID: '6ae62b18fc9d20139c933e66f3b2fd2f8d04c20d',
        address: '127.0.0.1',
        port: 1337,
        recordTimeoutFailure: recordTimeoutFailure,
        timeoutRate: 0.03
      }];

      const exec = sandbox.stub().callsArgWith(0, null, contacts);
      const sort = sandbox.stub().returns({
        exec: exec
      });
      const limit = sandbox.stub().returns({
        sort: sort
      });
      const find = sandbox.stub().returns({
        limit: limit
      });
      monitor.storage = {
        models: {
          Contact: {
            find: find
          }
        }
      };
      monitor.wait = sandbox.stub();
      monitor._replicateFarmer = sinon.stub();
      monitor.run();

      expect(find.callCount).to.equal(1);
      expect(find.args[0][0]).to.eql({
        $or: [
          { timeoutRate: { $lt: 0.04 } },
          { timeoutRate: { $exists: false } }
        ]
      });

      expect(sort.callCount).to.equal(1);
      expect(sort.args[0][0]).to.eql({lastSeen: 1});
      expect(monitor.wait.callCount).to.equal(1);
      expect(exec.callCount).to.equal(1);
      expect(limit.callCount).to.equal(1);
      expect(limit.args[0][0]).to.equal(100);

      expect(log.error.callCount).to.equal(3);

      expect(log.error.args[0][1])
        .to.equal('7b8b30132e930c7827ee47efebfb197d6a3246d4');
      expect(log.error.args[0][2])
        .to.equal('Farmer offline');

      expect(log.error.args[1][1])
        .to.equal('dd985ca22f19858257b3328a56f8f4aabee1d4a1');
      expect(log.error.args[1][2])
        .to.equal('Farmer offline');

      expect(log.error.args[2][1])
        .to.equal('dd985ca22f19858257b3328a56f8f4aabee1d4a1');
      expect(log.error.args[2][2])
        .to.equal('Mongo error');

      expect(recordTimeoutFailure.callCount).to.equal(2);
      expect(save.callCount).to.equal(2);

      expect(log.info.callCount).to.equal(2);
      expect(log.warn.callCount).to.equal(1);
      expect(log.warn.args[0][1])
        .to.equal('7b8b30132e930c7827ee47efebfb197d6a3246d4');
      expect(log.warn.args[0][2])
        .to.equal(0.05);
      expect(monitor._replicateFarmer.callCount).to.equal(1);
      expect(monitor._replicateFarmer.args[0][0])
        .to.be.instanceOf(storj.Contact);

      expect(monitor.network.ping.callCount).to.equal(3);
      expect(monitor.network.ping.args[0][0]).to.be.instanceOf(storj.Contact);
    });

  });

  describe('_randomTime', function() {

    it('will select a random number between min and max', function() {
      const monitor = new Monitor(config);
      const time = monitor._randomTime(600000, 300000);
      expect(time).to.be.above(299999); // 5min
      expect(time).to.be.below(600001); // 10min
    });

    it('will throw with invalid options', function() {
      const monitor = new Monitor(config);
      expect(function() {
        monitor._randomTime(300000, 600000);
      }).to.throw('Assertion');
    });

  });

  describe('#wait', function() {

    it('will set a timeout, and call run', function() {
      const time = sandbox.useFakeTimers();

      const monitor = new Monitor(config);
      monitor.run = sandbox.stub();
      monitor._randomTime = sandbox.stub().returns(1000);
      monitor._timeout = setTimeout(() => {
        throw new Error('This should not happen');
      }, 5);
      monitor.wait();
      time.tick(1001);
      expect(monitor.run.callCount).to.equal(1);
    });

  });

});
