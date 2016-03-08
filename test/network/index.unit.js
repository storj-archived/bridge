'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const EventEmitter = require('events').EventEmitter;

const Network = require('../..').Network;
const Config = require('../..').Config;
const Storage = require('../..').Storage;

describe('Network', function() {

  const config = Config('__tmptest');
  const storage = Storage(config.storage);
  const datadir = config.network.datadir;
  const options = {
    datadir: datadir,
    storage: storage
  };

  describe('#createInterface', function() {

    it('should bubble error from contact recall', function(done) {
      var _Contact = sinon.stub(
        storage.models.Contact,
        'recall'
      ).callsArgWith(1, new Error('Failed'));
      Network.createInterface(options, function(err) {
        _Contact.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should call the storj.Network#join', function(done) {
      var StubNetwork = proxyquire('../../lib/network', {
        storj: {
          Network: function() {
            return {
              _router: new EventEmitter(),
              join: sinon.stub().callsArg(0)
            };
          }
        }
      });
      StubNetwork.createInterface(options, done);
    });

    it('should record contact updates on add/shift router', function(done) {
      var _router = new EventEmitter();
      var StubNetwork = proxyquire('../../lib/network', {
        storj: {
          Network: function() {
            return {
              _router: _router,
              join: sinon.stub().callsArg(0)
            };
          }
        }
      });
      var _recall = sinon.stub(
        storage.models.Contact,
        'recall'
      ).callsArgWith(1, null, []);
      var _record = sinon.stub(
        storage.models.Contact,
        'record'
      );
      StubNetwork.createInterface(options, function(err) {
        expect(err).to.equal(undefined);
        _router.emit('add');
        _router.emit('shift');
        setImmediate(function() {
          expect(_record.callCount).to.equal(2);
          _recall.restore();
          _record.restore();
          done();
        });
      });
    });

  });

});
