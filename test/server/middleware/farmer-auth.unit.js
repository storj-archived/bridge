'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const auth = require('../../../lib/server/middleware/farmer-auth');

describe('Farmer Authentication Middleware', function() {
  const sandbox = sinon.sandbox.create();
  afterEach(() => sandbox.restore());

  describe('#authFarmer', function() {
    it('will give error for invalid timestamp', function() {

    });
    it('will give error for invalid pubkey', function() {

    });
    it('will give error for invalid nodeid', function() {

    });
    it('will give error if missing body', function() {

    });
    it('will give error for invalid signature', function() {

    });
    it('will continue without error', function() {
    });
  });


  describe('#checkTimestamp', function() {
    it('return false with timestamp below threshold', function() {
      const clock = sandbox.useFakeTimers();
      clock.tick(1502390208007 + 300000);
      let req = {
        headers: function(key) {
          if (key === 'timestamp') {
            return 1502390208007 - 300000 - 1;
          }
        }
      };
      expect(auth.checkTimestamp(req)).to.equal(false);
    });
    it('return false with timestamp above threshold', function() {
      const clock = sandbox.useFakeTimers();
      clock.tick(1502390208007 + 300000);
      let req = {
        headers: function(key) {
          if (key === 'timestamp') {
            return 1502390208007 + 600000 + 1;
          }
        }
      };
      expect(auth.checkTimestamp(req)).to.equal(false);
    });
    it('return true with timestamp within threshold', function() {
      const clock = sandbox.useFakeTimers();
      clock.tick(1502390208007 + 300000);
      let req = {
        headers: function(key) {
          if (key === 'timestamp') {
            return 1502390208007 + 300000 + 1;
          }
        }
      };
      expect(auth.checkTimestamp(req)).to.equal(true);
    });
  });

  describe('#checkNodeID', function() {
    it('return false for invalid nodeID (nonhex)', function() {
      const nodeID = 'somegarbage';
      const pubkey = '038cdc0b987405176647449b7f727444d263101f74e2a593d76ecedf11230706dd';
      expect(auth.checkNodeID(nodeID, pubkey)).to.equal(false);
    });
    it('return false for invalid nodeID (does not match pubkey)', function() {
      const nodeID = 'e6a498de631c6f3eba57da0e416881f9d4a6fca1';
      const pubkey = '038cdc0b987405176647449b7f727444d263101f74e2a593d76ecedf11230706dd';
      expect(auth.checkNodeID(nodeID, pubkey)).to.equal(false);
    });
    it('return true for valid nodeID ', function() {
      const nodeID = 'e6a498de631c6f3eba57da0e416881f9d4a6fca1';
      const pubkey = '03f716a870a72aaa61a75f5b06381ea1771f49c3a9866636007affc4ac06ef54b8';
      expect(auth.checkNodeID(nodeID, pubkey)).to.equal(true);
    });
  });

  describe('#checkPubkey', function() {
    it('will fail if pubkey is an invalid format (nonhex doubles)', function() {
      const pubkey = '38cdc0b987405176647449b7f727444d263101f74e2a593d76ecedf11230706dd';
      expect(auth.checkPubkey(pubkey)).to.equal(false);
    });
    it('will fail if pubkey is an invalid format (nonhex)', function() {
      const pubkey = 'z38cdc0b987405176647449b7f727444d263101f74e2a593d76ecedf11230706dd';
      expect(auth.checkPubkey(pubkey)).to.equal(false);
    });
    it('return false if invalid pubkey (serialization)', function() {
      const pubkey = '098cdc0b987405176647449b7f727444d263101f74e2a593d76ecedf11230706dd';
      expect(auth.checkPubkey(pubkey)).to.equal(false);
    });
    it('return true for valid pubkey', function() {
      const pubkey = '038cdc0b987405176647449b7f727444d263101f74e2a593d76ecedf11230706dd';
      expect(auth.checkPubkey(pubkey)).to.equal(true);
    });
  });

  describe('#checkSig', function() {
    it('will verify that signature is correct', function() {

    });
    it('will verify that signature is incorrect', function() {

    });
  });

  describe('#isHexaString', function() {
    it('return false for nonhex string', function() {
    });
    it('return true for hex string', function() {
    });
  });

  describe('#getSigHash', function() {
    it('will get the expected hash from the request', function() {

    });
    it('will get the expected hash from the request (utf-8)', function() {

    });
  });
});
