'use strict';

const async = require('async');
const expect = require('chai').expect;
const mongoose = require('mongoose');
const storj = require('storj-lib');

require('mongoose-types').loadTypes(mongoose);

const ContactSchema = require('../../lib/storage/models/contact');

var Contact;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__storj-bridge-test',
    function() {
      Contact = ContactSchema(connection);
      done();
    }
  );
});

after(function(done) {
  Contact.remove({}, function() {
    connection.close(done);
  });
});

describe('Storage/models/Contact', function() {

  describe('#record', function() {

    it('should record the unique contacts by their nodeID', function(done) {
      var nodes = [
        storj.KeyPair().getNodeID(),
        storj.KeyPair().getNodeID(),
        storj.KeyPair().getNodeID()
      ];
      nodes.push(nodes[0]);
      async.each(nodes, function(nodeID, next) {
        Contact.record({
          address: '127.0.0.1',
          port: 1337,
          nodeID: nodeID,
          lastSeen: Date.now()
        }, next);
      }, function(err) {
        expect(err).to.not.be.instanceOf(Error);
        Contact.count({}, function(err, count) {
          expect(count).to.equal(3);
          done();
        });
      });
    });

  });

  describe('#recall', function() {

    it('should recall the last N seen contacts', function(done) {
      Contact.recall(2, function(err, contacts) {
        expect(err).to.equal(null);
        expect(contacts).to.have.lengthOf(2);
        done();
      });
    });

  });

});
