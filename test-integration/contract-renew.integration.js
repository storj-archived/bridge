'use strict';

const storj = require('storj-lib');
const Logger = require('kad-logger-json');
const path = require('path');
const async = require('async');
const Config = require('../lib/config');
const Storage = require('storj-service-storage-models');
const { expect } = require('chai');
const { exec } = require('child_process');
const url = require('url');
const http = require('http');
const ms = require('ms');


describe('ContractRenewalJob', function() {

  const NOW = Date.now();

  const testConfigPath = path.join(
    __dirname,
    './_fixtures/contract-renew-test-config.json'
  );
  const testConfig = require(testConfigPath);
  const config = new Config(testConfig);
  const jobpath = path.join(__dirname, '../bin/storj-contract-renew.js');
  const command = [
    `node ${jobpath}`,
    `--config ${testConfigPath}`,
    `--datadir ${path.dirname(testConfigPath)}`
  ].join(' ');

  let storage, documents, landlord;

  before(function(done) {
    landlord = http.createServer((req, res) => res.end('{}')).listen(
      url.parse(config.complex.rpcUrl).port
    );
    documents = [];
    storage = new Storage(config.storage.mongoUrl, config.storage.mongoOpts, {
      logger: new Logger(0)
    });

    // **
    // INSERT TEST CONTACTS
    // **
    documents.push(new storage.models.Contact({
      _id: storj.utils.rmd160('contact1'),
      address: 'contact.one',
      port: 80,
      lastSeen: NOW,
      protocol: '0.0.0'
    }));
    documents.push(new storage.models.Contact({
      _id: storj.utils.rmd160('contact2'),
      address: 'contact.two',
      port: 80,
      lastSeen: NOW,
      protocol: '0.0.0'
    }));

    // **
    // INSERT TEST SHARD/CONTRACTS
    // **
    documents.push(new storage.models.Shard({
      hash: storj.utils.rmd160('shard1'),
      contracts: [
        {
          nodeID: storj.utils.rmd160('contact1'),
          contract: {
            store_begin: NOW - ms('89d'),
            store_end: NOW + ms('23h')
          }
        },
        {
          nodeID: storj.utils.rmd160('contact2'),
          contract: {
            data_hash: storj.utils.rmd160('shard1'),
            store_begin: NOW - ms('30d'),
            store_end: NOW + ms('1h')
          }
        },
        {
          nodeID: storj.utils.rmd160('contact3'),
          contract: {
            data_hash: storj.utils.rmd160('shard1'),
            store_begin: NOW,
            store_end: NOW + ms('90d')
          }
        }
      ]
    }));
    documents.push(new storage.models.Shard({
      hash: storj.utils.rmd160('shard2'),
      contracts: [
        {
          nodeID: storj.utils.rmd160('contact1'),
          contract: {
            data_hash: storj.utils.rmd160('shard2'),
            store_begin: NOW - ms('3d'),
            store_end: NOW + ms('30s')
          }
        },
        {
          nodeID: storj.utils.rmd160('contact2'),
          contract: {
            data_hash: storj.utils.rmd160('shard2'),
            store_begin: NOW - ms('4d'),
            store_end: NOW + ms('12h')
          }
        }
      ]
    }));
    documents.push(new storage.models.Shard({
      hash: storj.utils.rmd160('shard3'),
      contracts: [
        {
          nodeID: storj.utils.rmd160('contact1'),
          contract: {
            data_hash: storj.utils.rmd160('shard3'),
            store_begin: NOW - ms('1d'),
            store_end: NOW + ms('5h')
          }
        },
        {
          nodeID: storj.utils.rmd160('contact2'),
          contract: {
            data_hash: storj.utils.rmd160('shard3'),
            store_begin: NOW - ms('1y'),
            store_end: NOW + ms('20m')
          }
        }
      ]
    }));
    documents.push(new storage.models.Shard({
      hash: storj.utils.rmd160('shard4'),
      contracts: [
        {
          nodeID: storj.utils.rmd160('contact3'),
          contract: {
            data_hash: storj.utils.rmd160('shard4'),
            store_begin: NOW - ms('1m'),
            store_end: NOW + ms('1m')
          }
        },
        {
          nodeID: storj.utils.rmd160('contact2'),
          contract: {
            data_hash: storj.utils.rmd160('shard4'),
            store_begin: NOW - ms('8d'),
            store_end: NOW + ms('16h')
          }
        }
      ]
    }));
    documents.push(new storage.models.Shard({
      hash: storj.utils.rmd160('shard5'),
      contracts: [
        {
          nodeID: storj.utils.rmd160('contact1'),
          contract: {
            data_hash: storj.utils.rmd160('shard5'),
            store_begin: NOW - ms('15s'),
            store_end: NOW + ms('11h')
          }
        },
        {
          nodeID: storj.utils.rmd160('contact3'),
          contract: {
            data_hash: storj.utils.rmd160('shard5'),
            store_begin: NOW - ms('15d'),
            store_end: NOW + ms('15m')
          }
        }
      ]
    }));

    // **
    // INSERT TEST POINTERS
    // **
    let p1 = new storage.models.Pointer({
      index: 0,
      hash: storj.utils.rmd160('shard1'),
      size: 4096
    });
    documents.push(p1);
    let p2 = new storage.models.Pointer({
      index: 0,
      hash: storj.utils.rmd160('shard2'),
      size: 4096
    });
    documents.push(p2);
    let p3 = new storage.models.Pointer({
      index: 0,
      hash: storj.utils.rmd160('shard3'),
      size: 4096
    });
    documents.push(p3);
    let p4 = new storage.models.Pointer({
      index: 0,
      hash: storj.utils.rmd160('shard4'),
      size: 4096
    });
    documents.push(p4);
    let p5 = new storage.models.Pointer({
      index: 0,
      hash: storj.utils.rmd160('shard5'),
      size: 4096
    });
    documents.push(p5);

    // **
    // INSERT TEST FRAMES
    // **
    let f1 = new storage.models.Frame({
      shards: [p1._id, p2._id, p3._id]
    });
    documents.push(f1);
    let f2 = new storage.models.Frame({
      shards: [p4._id, p5._id]
    });
    documents.push(f2);

    // **
    // INSERT TEST BUCKET ENTRIES
    // **
    documents.push(new storage.models.BucketEntry({
      frame: f1._id
    }));

    async.eachSeries(documents, (doc, next) => doc.save(next), done);
  });

  it('should renew all contracts needed', function(done) {
    this.timeout(10000);
    function parseStderr(err) {
      let errLines = err.split('\n');
      return new Error(
        JSON.parse(errLines[errLines.length - 1]).error
      );
    }
    exec(command, (err, stdout, stderr) => {
      if (err) {
        return done(parseStderr(stderr));
      }
      let { processed, errored, renewed } = JSON.parse(stdout);
      expect(processed).to.equal(6);
      expect(errored).to.equal(2);
      expect(renewed).to.equal(4);
      exec(command, (err, stdout, stderr) => {
        if (err) {
          return done(parseStderr(stderr));
        }
        let { processed, errored, renewed } = JSON.parse(stdout);
        expect(processed).to.equal(2);
        expect(errored).to.equal(2);
        expect(renewed).to.equal(0);
        done();
      });
    });
  });

  after(function(done) {
    landlord.close();
    async.eachSeries(documents, (doc, next) => doc.remove(next), done);
  });

});
