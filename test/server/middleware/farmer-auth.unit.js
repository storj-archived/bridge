'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const errors = require('storj-service-error-types');
const secp256k1 = require('secp256k1');
const auth = require('../../../lib/server/middleware/farmer-auth');

describe('Farmer Authentication Middleware', function() {
  const sandbox = sinon.sandbox.create();
  afterEach(() => sandbox.restore());

  describe('#authFarmer', function() {
    const nodeID = 'e6a498de631c6f3eba57da0e416881f9d4a6fca1';
    const pubkey = '03f716a870a72aaa61a75f5b06381ea1771f49c3a9866636007affc4ac06ef54b8';
    const timestamp = '1502390208007';
    const signature = 'signature';
    const req = {
      headers: {
        'x-node-id': nodeID,
        'x-node-pubkey': pubkey,
        'x-node-timestamp': timestamp,
        'x-node-signature': signature
      },
      rawbody: Buffer.from('ffff', 'hex')
    };
    const res = {};
    it('will give error for invalid timestamp', function(done) {
      sandbox.stub(auth, 'checkTimestamp').returns(false);
      auth.authFarmer(req, res, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });
    it('will give error for invalid pubkey', function(done) {
      sandbox.stub(auth, 'checkTimestamp').returns(true);
      sandbox.stub(auth, 'checkPubkey').returns(false);
      auth.authFarmer(req, res, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });
    it('will give error for invalid nodeid', function(done) {
      sandbox.stub(auth, 'checkTimestamp').returns(true);
      sandbox.stub(auth, 'checkPubkey').returns(true);
      sandbox.stub(auth, 'checkNodeID').returns(false);
      auth.authFarmer(req, res, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });
    it('will give error if missing body', function(done) {
      const reqNoBody = {
        headers: {
          'x-node-id': nodeID,
          'x-node-pubkey': pubkey,
          'x-node-timestamp': timestamp,
          'x-node-signature': signature
        },
        rawbody: null
      };
      sandbox.stub(auth, 'checkTimestamp').returns(true);
      sandbox.stub(auth, 'checkPubkey').returns(true);
      sandbox.stub(auth, 'checkNodeID').returns(true);
      auth.authFarmer(reqNoBody, res, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });
    it('will give error for invalid signature', function(done) {
      sandbox.stub(auth, 'checkTimestamp').returns(true);
      sandbox.stub(auth, 'checkPubkey').returns(true);
      sandbox.stub(auth, 'checkNodeID').returns(true);
      sandbox.stub(auth, 'checkSig').returns(false);
      auth.authFarmer(req, res, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });
    it('will continue without error', function(done) {
      sandbox.stub(auth, 'checkTimestamp').returns(true);
      sandbox.stub(auth, 'checkPubkey').returns(true);
      sandbox.stub(auth, 'checkNodeID').returns(true);
      sandbox.stub(auth, 'checkSig').returns(true);
      auth.authFarmer(req, res, done);
    });
  });


  describe('#checkTimestamp', function() {
    it('return false with timestamp below threshold', function() {
      const clock = sandbox.useFakeTimers();
      clock.tick(1502390208007 + 300000);
      let timestamp = (1502390208007 - 300000 - 1).toString();
      expect(auth.checkTimestamp(timestamp)).to.equal(false);
    });
    it('return false with timestamp above threshold', function() {
      const clock = sandbox.useFakeTimers();
      clock.tick(1502390208007 + 300000);
      let timestamp = (1502390208007 + 600000 + 1).toString();
      expect(auth.checkTimestamp(timestamp)).to.equal(false);
    });
    it('return true with timestamp within threshold', function() {
      const clock = sandbox.useFakeTimers();
      clock.tick(1502390208007 + 300000);
      let timestamp = (1502390208007 + 300000 + 1).toString();
      expect(auth.checkTimestamp(timestamp)).to.equal(true);
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
      let privkey = '8e812246e61ea983efdd4d1c86e246832667a4e4b8fc2d9ff01c534c8a6d7681';
      let pubkey = '03ea58aff546b28bb748d560ad05bb78c0e1b9f5de8edc5021494833c73c224284';
      let req = {
        headers: {
          'x-node-timestamp': '1502390208007',
          'x-node-pubkey': pubkey
        },
        method: 'POST',
        protocol: 'https',
        originalUrl: '/contacts?someQueryArgument=value',
        get: function(key) {
          if (key === 'host') {
            return 'api.storj.io';
          }
        },
        rawbody: Buffer.from('{"key": "value"}', 'utf8')
      };
      const sighash = auth.getSigHash(req);
      const sigObj = secp256k1.sign(sighash, Buffer.from(privkey, 'hex'));
      let sig = secp256k1.signatureExport(sigObj.signature).toString('hex');
      req.headers['x-node-signature'] = sig;
      expect(auth.checkSig(req)).to.equal(true);
    });
    it('will verify that signature is incorrect', function() {
      let privkey = '8e812246e61ea983efdd4d1c86e246832667a4e4b8fc2d9ff01c534c8a6d7681';
      let pubkey = '03ea58aff546b28bb748d560ad05bb78c0e1b9f5de8edc5021494833c73c224284';
      let timestamp = '1502390208007';
      let sig = null;
      let req = {
        headers: {
          'x-node-timestamp': timestamp,
          'x-node-pubkey': pubkey,
          'x-node-signature': sig
        },
        method: 'POST',
        protocol: 'https',
        originalUrl: '/contacts?someQueryArgument=value',
        get: function(key) {
          if (key === 'host') {
            return 'api.storj.io';
          }
        },
        rawbody: Buffer.from('{"key": "value"}', 'utf8')
      };
      const sighash = auth.getSigHash(req);
      const sigObj = secp256k1.sign(sighash, Buffer.from(privkey, 'hex'));
      sig = secp256k1.signatureExport(sigObj.signature).toString('hex');
      // change the data so the signature fails
      timestamp = '1502390208009';
      expect(auth.checkSig(req)).to.equal(false);
    });
  });

  describe('#isHexaString', function() {
    it('return false for nonhex string', function() {
      expect(auth.isHexString('zz')).to.equal(false);
    });
    it('return false for nonhex string (incorrect bytes)', function() {
      expect(auth.isHexString('aaa')).to.equal(false);
    });
    it('return true for hex string', function() {
      expect(auth.isHexString('038c')).to.equal(true);
    });
  });

  describe('#getSigHash', function() {
    it('will get the expected hash from the request', function() {
      let req = {
        headers: {
          'x-node-timestamp': '1502390208007'
        },
        method: 'POST',
        protocol: 'https',
        originalUrl: '/contacts?someQueryArgument=value',
        get: function(key) {
          if (key === 'host') {
            return 'api.storj.io';
          }
        },
        rawbody: Buffer.from('{"key": "value"}', 'utf8')
      };
      const hash = auth.getSigHash(req);
      expect(hash.toString('hex')).to.equal('59146f00725c9c052ef5ec6acd63f3842728c9d191ac146668204de6ed4a648b');
    });
    it('will get the expected hash while behind https proxy', function() {
      let req = {
        headers: {
          'x-node-timestamp': '1502390208007',
          'x-forwarded-proto': 'https'
        },
        method: 'POST',
        protocol: 'http',
        originalUrl: '/contacts?someQueryArgument=value',
        get: function(key) {
          if (key === 'host') {
            return 'api.storj.io';
          }
        },
        rawbody: Buffer.from('{"key": "value"}', 'utf8')
      };
      const hash = auth.getSigHash(req);
      expect(hash.toString('hex')).to.equal('59146f00725c9c052ef5ec6acd63f3842728c9d191ac146668204de6ed4a648b');
    });
  });
});
