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

    it.skip('should return internal error if query fails');

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

  describe('#getContactByNodeID', function() {

    it.skip('should return internal error if query fails');

    it.skip('should return not found error if no contact');

    it.skip('should return the contact if found');

  });

});
