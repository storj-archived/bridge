'use strict';

const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const ContactsRouter = require('../../../lib/server/routes/contacts');

describe('ContactsRouter', function() {

  var contactsRouter = new ContactsRouter(
    require('../../_fixtures/router-opts')
  );

  describe('#getContactList', function() {

    it('should return internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/contacts',
        query: {
          protocol: '0.10.0',
          nodeID: 'some bad node id'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _contactFind = sinon.stub(
        contactsRouter.storage.models.Contact,
        'find'
      ).returns({
        skip: function() { return this; },
        limit: function() { return this; },
        sort: function() { return this; },
        exec: sinon.stub().callsArgWith(0, new Error('Panic!'))
      });
      contactsRouter.getContactList(request, response, function(err) {
        _contactFind.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return the sorted contact list', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/contacts',
        query: {
          protocol: '0.10.0'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var contact1 = new contactsRouter.storage.models.Contact({
        address: '127.0.0.1',
        port: 1337,
        _id: storj.utils.rmd160('1'),
        lastSeen: Date.now() - 10
      });
      var contact2 = new contactsRouter.storage.models.Contact({
        address: '127.0.0.1',
        port: 1338,
        _id: storj.utils.rmd160('2'),
        lastSeen: Date.now() + 10
      });
      var _contactFind = sinon.stub(
        contactsRouter.storage.models.Contact,
        'find'
      ).returns({
        skip: function() { return this; },
        limit: function() { return this; },
        sort: function() { return this; },
        exec: sinon.stub().callsArgWith(0, null, [
          contact1,
          contact2
        ])
      });
      response.on('end', function() {
        var result = response._getData();
        _contactFind.restore();
        expect(result[0].nodeID).to.equal(storj.utils.rmd160('2'));
        expect(result[1].nodeID).to.equal(storj.utils.rmd160('1'));
        done();
      });
      contactsRouter.getContactList(request, response);
    });

  });

  describe('#patchContactByNodeID', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('will send back a response on success', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/contacts/somenodeid',
        body: {
          address: '127.0.0.1',
          port: 9000,
          spaceAvailable: false
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const contact = {
        address: '127.0.0.1',
        port: 9000,
        spaceAvailable: false
      };

      const findOneAndUpdate = sandbox.stub(
        contactsRouter.storage.models.Contact,
        'findOneAndUpdate'
      ).callsArgWith(3, null, contact);

      sandbox.stub(contactsRouter, 'setDefaultResponseTime');
      sandbox.stub(contactsRouter, 'setDefaultReputation');

      response.on('end', function() {
        var result = response._getData();
        expect(findOneAndUpdate.callCount).to.equal(1);
        expect(findOneAndUpdate.args[0][1]).to.eql({
          $set: {
            address: '127.0.0.1',
            port: 9000,
            spaceAvailable: false
          }
        });
        expect(contactsRouter.setDefaultResponseTime.callCount).to.equal(1);
        expect(contactsRouter.setDefaultReputation.callCount).to.equal(1);
        done();
      });

      contactsRouter.patchContactByNodeID(request, response, function() {});
    });
  });

  describe('#getContactByNodeID', function() {

    it('should return internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/contacts/somenodeid',
        params: {
          nodeID: 'somenodeid'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _contactFind = sinon.stub(
        contactsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      contactsRouter.getContactByNodeID(request, response, function(err) {
        _contactFind.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should return not found error if no contact', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/contacts/' + storj.utils.rmd160('nodeid'),
        params: {
          nodeID: storj.utils.rmd160('nodeid')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _contactFind = sinon.stub(
        contactsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, null);
      contactsRouter.getContactByNodeID(request, response, function(err) {
        _contactFind.restore();
        expect(err.message).to.equal('Contact not found');
        done();
      });
    });

    it('should return the contact if found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/contacts/somenodeid',
        params: {
          nodeID: 'somenodeid'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var contact1 = new contactsRouter.storage.models.Contact({
        address: '127.0.0.1',
        port: 1337,
        _id: storj.utils.rmd160('1'),
        lastSeen: Date.now()
      });
      var _contactFind = sinon.stub(
        contactsRouter.storage.models.Contact,
        'findOne'
      ).callsArgWith(1, null, contact1);
      response.on('end', function() {
        _contactFind.restore();
        expect(response._getData().nodeID).equal(contact1.nodeID);
        done();
      });
      contactsRouter.getContactByNodeID(request, response);
    });

  });

});
