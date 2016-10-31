'use strict';

const expect = require('chai').expect;
const PubkeysRouter = require('../../../lib/server/routes/pubkeys');

describe('PubkeysRouter', function() {

  describe('#getPublicKeys', function() {

    it.skip('should return internal error if query fails');

    it.skip('should return list of pubkeys');

  });

  describe('#addPublicKey', function() {

    it.skip('should return internal error if mongodb fails');

    it.skip('should return bad request if validation fails');

    it.skip('should return the created public key');

  });

  describe('#destroyPublicKey', function() {

    it.skip('should return internal error if query fails');

    it.skip('should return not found if no public key');

    it.skip('should return internal error if remove fails');

    it.skip('should return a 200 if delete succeeds');

  });

});

