'use strict';

const expect = require('chai').expect;
const Engine = require('..').Engine;
const Config = require('..').Config;
const Storage = require('storj-service-storage-models');
const Mailer = require('..').Mailer;
const Server = require('..').Server;

describe('Engine', function() {

  describe('@constructor', function() {

    it('should create instance without the new keyword', function() {
      expect(Engine(Config('__tmptest'))).to.be.instanceOf(Engine);
    });

    it('should keep reference to config', function() {
      var config = Config('__tmptest');
      var engine = new Engine(config);
      expect(engine._config).to.equal(config);
    });

  });

  describe('#getSpecification', function() {

    var config = Config('__tmptest');
    var engine = new Engine(config);

    it('should return the swagger specification', function() {
      var spec = engine.getSpecification();
      expect(typeof spec).to.equal('object');
    });

    it('should return the cached swagger specification', function() {
      expect(engine._apispec).to.equal(engine.getSpecification());
    });

  });

  describe('#start', function() {

    it('should setup storage, mailer, server', function(done) {
      var config = Config('__tmptest');
      var engine = new Engine(config);
      engine.start(function(err) {
        expect(err).to.equal(undefined);
        expect(engine.storage).to.be.instanceOf(Storage);
        expect(engine.mailer).to.be.instanceOf(Mailer);
        expect(engine.server).to.be.instanceOf(Server);
        engine.server.server.close(function() {
          done();
        });
      });
    });

  });

});
