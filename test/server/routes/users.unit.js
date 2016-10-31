'use strict';

const expect = require('chai').expect;
const UsersRouter = require('../../../lib/server/routes/users');

describe('UsersRouter', function() {

  describe('#_dispatchActivationEmail', function() {

    it.skip('should callback error if mailer fails');

    it.skip('should callback null if mailer succeeds');

  });

  describe('#createUser', function() {

    it.skip('should callback error if creation fails');

    it.skip('should respond with user if creation succeeds');

    it.skip('should destroy user with bad request if pubkey fails');

    it.skip('should respond with user if user and pubkey succeed');

  });

  describe('#confirmActivateUser', function() {

    it.skip('should internal error if query fails');

    it.skip('should bad request error if bad token');

    it.skip('should internal if activate fails');

    it.skip('should redirect if success and redirect specified');

    it.skip('should respond with user if success');

  });

  describe('#reactivateUser', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if no user found');

    it.skip('should bad request if user already activated');

    it.skip('should send back user if activate success');

  });

  describe('#destroyUser', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if user not found');

    it.skip('should not authorized error if user does not match');

    it.skip('should callback error if mailer fails');

    it.skip('should internal error if user cannot be saved');

    it.skip('should send back user if mailer succeeds');

  });

  describe('#confirmDestroyUser', function() {

    it.skip('should internal error if query fails');

    it.skip('should not found error if user not found');

    it.skip('should internal error if deactivate fails');

    it.skip('should redirect on success if specified');

    it.skip('should send back user on successful deactivate');

  });

  describe('#createPasswordResetToken', function() {

    it.skip('should bad request error if invalid password');

    it.skip('should internal error if query fails');

    it.skip('should not found error if user not found');

    it.skip('should internal error if user cannot save');

    it.skip('should internal error if mailer fails');

    it.skip('should send back user if mailer succeeds');

  });

  describe('#confirmPasswordReset', function() {

    it.skip('should return error if invalid token');

    it.skip('should internal error if query fails');

    it.skip('should not found error if user not found');

    it.skip('should internal error if saving user fails');

    it.skip('should redirect on success if specified');

    it.skip('should send back user on success');

  });

});
