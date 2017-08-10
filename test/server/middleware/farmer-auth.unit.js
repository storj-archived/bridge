'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const pow = require('../../../lib/server/middleware/farmer-auth');

describe('Farmer Authentication Middleware', function() {

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

    });
    it('return false with timestamp above threshold', function() {

    });
    it('return true with timestamp within threshold', function() {

    });
  });

  describe('#checkNodeID', function() {
    it('return false for invalid nodeID (nonhex)', function() {
    });
    it('return false for invalid nodeID (does not match pubkey)', function() {
    });
    it('return true for valid nodeID ', function() {
    });
  });

  describe('#checkPubkey', function() {
    it('will fail if pubkey is an invalid format (nonhex)', function() {

    });
    it('will fail if pubkey is an invalid format (length)', function() {

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
