'use strict';

const expect = require('chai').expect;
const Config = require('../../lib/config');
const Storage = require('../../lib/storage');
const storj = require('storj');
const MongoAdapter = require('../../lib/storage/adapter');

var storage;

before(function(done) {
  storage = Storage(Config('__tmptest').storage);
  storage.connection.on('open', done);
});

after(function(done) {
  storage.models.Shard.remove({}, function() {
    storage.connection.close(done);
  });
});

describe('MongoAdapter', function() {

  describe('@constructor', function() {

    it('should create instance without the new keyword', function() {
      expect(MongoAdapter(storage)).to.be.instanceOf(MongoAdapter);
    });

    it('should inherit from the storj.StorageAdapter', function() {
      expect(MongoAdapter(storage)).to.be.instanceOf(storj.StorageAdapter);
    });

    it('should use the shard model', function() {
      var adapter = new MongoAdapter(storage);
      expect(adapter._model).to.equal(storage.models.Shard);
    });

  });

  describe('#_put', function() {

    it('should put the storage item in the collection', function(done) {
      var adapter = new MongoAdapter(storage);
      var item = new storj.StorageItem({ hash: 'test' });
      adapter._put('test', item, function(err, shard) {
        expect(err).to.not.be.instanceOf(Error);
        expect(shard.hash).to.equal('test');
        done();
      });
    });

  });

  describe('#_get', function() {

    it('should get the item from the collection', function(done) {
      var adapter = new MongoAdapter(storage);
      adapter._get('test', function(err, item) {
        expect(err).to.not.be.instanceOf(Error);
        expect(item).to.be.instanceOf(storj.StorageItem);
        done();
      });
    });

  });

});
