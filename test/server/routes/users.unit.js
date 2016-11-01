'use strict';

const crypto = require('crypto');
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const UsersRouter = require('../../../lib/server/routes/users');

describe('UsersRouter', function() {

  var usersRouter = new UsersRouter(
    require('../../_fixtures/router-opts')
  );
  var someUser = new usersRouter.storage.models.User({
    _id: 'gordon@storj.io',
    hashpass: storj.utils.sha256('password')
  });

  describe('#_dispatchActivationEmail', function() {

    it('should callback error if mailer fails', function(done) {
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArgWith(3, new Error('Failed to send mail'));
      usersRouter._dispatchActivationEmail(
        new usersRouter.storage.models.User({
          _id: 'gordon@storj.io'
        }),
        true,
        function(err) {
          _dispatch.restore();
          expect(err.message).to.equal('Failed to send mail');
          done();
        }
      );
    });

    it('should callback null if mailer succeeds', function(done) {
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArgWith(3, null);
      usersRouter._dispatchActivationEmail(
        new usersRouter.storage.models.User({
          _id: 'gordon@storj.io'
        }),
        true,
        function(err) {
          _dispatch.restore();
          expect(err).to.equal(null);
          done();
        }
      );
    });

  });

  describe('#createUser', function() {

    it('should callback error if creation fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/users',
        body: {
          email: 'gordon@storj.io',
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCreate = sinon.stub(
        usersRouter.storage.models.User,
        'create'
      ).callsArgWith(2, new Error('Panic!'));
      usersRouter.createUser(request, response, function(err) {
        _userCreate.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should respond with user if creation succeeds', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/users',
        body: {
          email: 'gordon@storj.io',
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _dispatchActivationEmail = sinon.stub(
        usersRouter,
        '_dispatchActivationEmail'
      );
      var _userCreate = sinon.stub(
        usersRouter.storage.models.User,
        'create'
      ).callsArgWith(2, null, someUser);
      response.on('end', function() {
        _userCreate.restore();
        _dispatchActivationEmail.restore();
        expect(response._getData().email).to.equal('gordon@storj.io');
        done();
      });
      usersRouter.createUser(request, response);
    });

    it('should destroy user with bad request if pubkey fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/users',
        body: {
          email: 'gordon@storj.io',
          password: storj.utils.sha256('password'),
          pubkey: storj.KeyPair().getPublicKey()
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _dispatchActivationEmail = sinon.stub(
        usersRouter,
        '_dispatchActivationEmail'
      );
      var _userCreate = sinon.stub(
        usersRouter.storage.models.User,
        'create'
      ).callsArgWith(2, null, someUser);
      var _pubkeyCreate = sinon.stub(
        usersRouter.storage.models.PublicKey,
        'create'
      ).callsArgWith(2, new Error('Failed to create pubkey'));
      var _userRemove = sinon.stub(someUser, 'remove');
      usersRouter.createUser(request, response, function(err) {
        _userCreate.restore();
        _dispatchActivationEmail.restore();
        _pubkeyCreate.restore();
        _userRemove.restore();
        expect(_userRemove.called).to.equal(true);
        expect(err.message).to.equal('Failed to create pubkey');
        done();
      });
    });

    it('should respond with user if user and pubkey succeed', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/users',
        body: {
          email: 'gordon@storj.io',
          password: storj.utils.sha256('password'),
          pubkey: storj.KeyPair().getPublicKey()
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _dispatchActivationEmail = sinon.stub(
        usersRouter,
        '_dispatchActivationEmail'
      );
      var _userCreate = sinon.stub(
        usersRouter.storage.models.User,
        'create'
      ).callsArgWith(2, null, someUser);
      var _pubkeyCreate = sinon.stub(
        usersRouter.storage.models.PublicKey,
        'create'
      ).callsArgWith(2, null, { key: 'pubkey' });
      response.on('end', function() {
        _userCreate.restore();
        _dispatchActivationEmail.restore();
        _pubkeyCreate.restore();
        var result = response._getData();
        expect(result.email).to.equal('gordon@storj.io');
        expect(result.pubkey).to.equal('pubkey');
        done();
      });
      usersRouter.createUser(request, response);
    });

  });

  describe('#confirmActivateUser', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/activations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      usersRouter.confirmActivateUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should bad request error if bad token', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/activations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, null);
      usersRouter.confirmActivateUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Invalid activation token');
        done();
      });
    });

    it('should internal if activate fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/activations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _userActivate = sinon.stub(someUser, 'activate').callsArgWith(
        0,
        new Error('Failed to activate user')
      );
      usersRouter.confirmActivateUser(request, response, function(err) {
        _userFindOne.restore();
        _userActivate.restore();
        expect(err.message).to.equal('Failed to activate user');
        done();
      });
    });

    it('should redirect if success and redirect specified', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/activations/token',
        params: {
          token: 'token'
        },
        query: {
          redirect: 'someredirecturl'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _userActivate = sinon.stub(someUser, 'activate').callsArg(0);
      response.redirect = function() {
        _userFindOne.restore();
        _userActivate.restore();
        delete response.redirect;
        done();
      };
      usersRouter.confirmActivateUser(request, response);
    });

    it('should respond with user if success', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/activations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _userActivate = sinon.stub(someUser, 'activate').callsArg(0);
      response.on('end', function() {
        _userFindOne.restore();
        _userActivate.restore();
        expect(response._getData().email).to.equal('gordon@storj.io');
        done();
      });
      usersRouter.confirmActivateUser(request, response);
    });

  });

  describe('#reactivateUser', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/activations',
        body: {
          email: 'gordon@storj.io'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      usersRouter.reactivateUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should not found error if no user found', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/activations',
        body: {
          email: 'gordon@storj.io'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, null);
      usersRouter.reactivateUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('User not found');
        done();
      });
    });

    it('should bad request if user already activated', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/activations',
        body: {
          email: 'gordon@storj.io'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      someUser.activated = true;
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      usersRouter.reactivateUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('User is already activated');
        done();
      });
    });

    it('should send back user if activate success', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/activations',
        body: {
          email: 'gordon@storj.io'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      someUser.activated = false;
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _dispatchActivationEmail = sinon.stub(
        usersRouter,
        '_dispatchActivationEmail'
      );
      response.on('end', function() {
        _userFindOne.restore();
        _dispatchActivationEmail.restore();
        expect(_dispatchActivationEmail.called).to.equal(true);
        var result = response._getData();
        expect(result.email).to.equal('gordon@storj.io');
        done();
      });
      usersRouter.reactivateUser(request, response);
    });

  });

  describe('#destroyUser', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      usersRouter.destroyUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should not found error if user not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, null);
      usersRouter.destroyUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('User not found');
        done();
      });
    });

    it('should not authorized error if user does not match', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, { _id: 'alex@storj.io' });
      usersRouter.destroyUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Not authorized');
        done();
      });
    });

    it('should callback error if mailer fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArgWith(3, new Error('Failed to send mail'));
      usersRouter.destroyUser(request, response, function(err) {
        _userFindOne.restore();
        _dispatch.restore();
        expect(err.message).to.equal('Failed to send mail');
        done();
      });
    });

    it('should internal error if user cannot be saved', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArgWith(3, null);
      var _userSave = sinon.stub(someUser, 'save').callsArgWith(
        0,
        new Error('Failed to update user')
      );
      usersRouter.destroyUser(request, response, function(err) {
        _userFindOne.restore();
        _dispatch.restore();
        _userSave.restore();
        expect(err.message).to.equal('Failed to update user');
        done();
      });
    });

    it('should send back user if mailer succeeds', function(done) {
      var request = httpMocks.createRequest({
        method: 'DELETE',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        }
      });
      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArgWith(3, null);
      var _userSave = sinon.stub(someUser, 'save').callsArg(0);
      response.on('end', function() {
        _userFindOne.restore();
        _dispatch.restore();
        _userSave.restore();
        expect(response._getData().email).to.equal('gordon@storj.io');
        done();
      });
      usersRouter.destroyUser(request, response);
    });

  });

  describe('#confirmDestroyUser', function() {

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/deactivations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      usersRouter.confirmDestroyUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should not found error if user not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/deactivations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, null);
      usersRouter.confirmDestroyUser(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('User not found');
        done();
      });
    });

    it('should internal error if deactivate fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/deactivations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _deactivate = sinon.stub(someUser, 'deactivate').callsArgWith(
        0,
        new Error('Failed to deactivate user')
      );
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      usersRouter.confirmDestroyUser(request, response, function(err) {
        _userFindOne.restore();
        _deactivate.restore();
        expect(err.message).to.equal('Failed to deactivate user');
        done();
      });
    });

    it('should redirect on success if specified', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/deactivations/token',
        params: {
          token: 'token'
        },
        query: {
          redirect: 'someredirecturl'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _deactivate = sinon.stub(someUser, 'deactivate').callsArg(0);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      response.redirect = function() {
        _userFindOne.restore();
        _deactivate.restore();
        delete response.redirect;
        done();
      };
      usersRouter.confirmDestroyUser(request, response);
    });

    it('should send back user on successful deactivate', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/deactivations/token',
        params: {
          token: 'token'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _deactivate = sinon.stub(someUser, 'deactivate').callsArg(0);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      response.on('end', function() {
        _userFindOne.restore();
        _deactivate.restore();
        delete response.redirect;
        done();
      });
      usersRouter.confirmDestroyUser(request, response);
    });

  });

  describe('#createPasswordResetToken', function() {

    it('should bad request error if invalid password', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        },
        body: {
          password: 'badpassword'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      usersRouter.createPasswordResetToken(request, response, function(err) {
        expect(err.message).to.equal(
          'Password must be hex encoded SHA-256 hash'
        );
        done();
      });
    });

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        },
        body: {
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, new Error('Panic!'));
      usersRouter.createPasswordResetToken(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should not found error if user not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        },
        body: {
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, null);
      usersRouter.createPasswordResetToken(request, response, function(err) {
        _userFindOne.restore();
        expect(err.message).to.equal('User not found');
        done();
      });
    });

    it('should internal error if user cannot save', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        },
        body: {
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userSave = sinon.stub(someUser, 'save').callsArgWith(
        0,
        new Error('Failed to save user')
      );
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      usersRouter.createPasswordResetToken(request, response, function(err) {
        _userFindOne.restore();
        _userSave.restore();
        expect(err.message).to.equal('Failed to save user');
        done();
      });
    });

    it('should internal error if mailer fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        },
        body: {
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userSave = sinon.stub(someUser, 'save').callsArg(0);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArgWith(3, new Error('Failed to send mail'));
      usersRouter.createPasswordResetToken(request, response, function(err) {
        _userFindOne.restore();
        _userSave.restore();
        _dispatch.restore();
        expect(err.message).to.equal('Failed to send mail');
        done();
      });
    });

    it('should send back user if mailer succeeds', function(done) {
      var request = httpMocks.createRequest({
        method: 'PATCH',
        url: '/users/gordon@storj.io',
        params: {
          id: 'gordon@storj.io'
        },
        body: {
          password: storj.utils.sha256('password')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userSave = sinon.stub(someUser, 'save').callsArg(0);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).callsArgWith(1, null, someUser);
      var _dispatch = sinon.stub(
        usersRouter.mailer,
        'dispatch'
      ).callsArg(3);
      response.on('end', function() {
        _userFindOne.restore();
        _userSave.restore();
        _dispatch.restore();
        expect(response._getData().email).to.equal('gordon@storj.io');
        done();
      });
      usersRouter.createPasswordResetToken(request, response);
    });

  });

  describe('#confirmPasswordReset', function() {

    it('should return error if invalid token', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/resets/badtoken',
        params: {
          token: 'badtoken'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCount = sinon.stub(
        usersRouter.storage.models.User,
        'count'
      ).callsArgWith(1, null, 1);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).returns({
        skip: function() {
          return this;
        },
        exec: sinon.stub().callsArg(0)
      });
      usersRouter.confirmPasswordReset(request, response, function(err) {
        _userCount.restore();
        _userFindOne.restore();
        expect(err.message).to.equal(
          'Resetter must be hex encoded 256 byte string'
        );
        done();
      });
    });

    it('should internal error if query fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/resets/badtoken',
        params: {
          token: crypto.randomBytes(256).toString('hex')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCount = sinon.stub(
        usersRouter.storage.models.User,
        'count'
      ).callsArgWith(1, null, 1);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).returns({
        skip: function() {
          return this;
        },
        exec: sinon.stub().callsArg(0)
      });
      _userFindOne.onCall(0).callsArgWith(1, new Error('Panic!'));
      usersRouter.confirmPasswordReset(request, response, function(err) {
        _userCount.restore();
        _userFindOne.restore();
        expect(err.message).to.equal('Panic!');
        done();
      });
    });

    it('should not found error if user not found', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/resets/badtoken',
        params: {
          token: crypto.randomBytes(256).toString('hex')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCount = sinon.stub(
        usersRouter.storage.models.User,
        'count'
      ).callsArgWith(1, null, 1);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).returns({
        skip: function() {
          return this;
        },
        exec: sinon.stub().callsArg(0)
      });
      _userFindOne.onCall(0).callsArgWith(1, null, null);
      usersRouter.confirmPasswordReset(request, response, function(err) {
        _userCount.restore();
        _userFindOne.restore();
        expect(err.message).to.equal('User not found');
        done();
      });
    });

    it('should internal error if saving user fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/resets/badtoken',
        params: {
          token: crypto.randomBytes(256).toString('hex')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCount = sinon.stub(
        usersRouter.storage.models.User,
        'count'
      ).callsArgWith(1, null, 1);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).returns({
        skip: function() {
          return this;
        },
        exec: sinon.stub().callsArg(0)
      });
      var _userSave = sinon.stub(
        someUser,
        'save'
      ).callsArgWith(0, new Error('Failed to save user'));
      _userFindOne.onCall(0).callsArgWith(1, null, someUser);
      usersRouter.confirmPasswordReset(request, response, function(err) {
        _userCount.restore();
        _userFindOne.restore();
        _userSave.restore();
        expect(err.message).to.equal('Failed to save user');
        done();
      });
    });

    it('should redirect on success if specified', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/resets/badtoken',
        params: {
          token: crypto.randomBytes(256).toString('hex')
        },
        query: {
          redirect: 'someredirecturl'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCount = sinon.stub(
        usersRouter.storage.models.User,
        'count'
      ).callsArgWith(1, null, 1);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).returns({
        skip: function() {
          return this;
        },
        exec: sinon.stub().callsArg(0)
      });
      var _userSave = sinon.stub(someUser, 'save').callsArg(0);
      _userFindOne.onCall(0).callsArgWith(1, null, someUser);
      response.redirect = function() {
        _userCount.restore();
        _userFindOne.restore();
        _userSave.restore();
        delete response.redirect;
        done();
      };
      usersRouter.confirmPasswordReset(request, response);
    });

    it('should send back user on success', function(done) {
      var request = httpMocks.createRequest({
        method: 'GET',
        url: '/resets/badtoken',
        params: {
          token: crypto.randomBytes(256).toString('hex')
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var _userCount = sinon.stub(
        usersRouter.storage.models.User,
        'count'
      ).callsArgWith(1, null, 1);
      var _userFindOne = sinon.stub(
        usersRouter.storage.models.User,
        'findOne'
      ).returns({
        skip: function() {
          return this;
        },
        exec: sinon.stub().callsArg(0)
      });
      var _userSave = sinon.stub(someUser, 'save').callsArg(0);
      _userFindOne.onCall(0).callsArgWith(1, null, someUser);
      response.on('end', function() {
        _userCount.restore();
        _userFindOne.restore();
        _userSave.restore();
        done();
      });
      usersRouter.confirmPasswordReset(request, response);
    });

  });

});
