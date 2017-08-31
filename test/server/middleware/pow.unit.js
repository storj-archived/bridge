'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const redis = require('redis').createClient();
const pow = require('../../../lib/server/middleware/pow');

const MAX = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

describe('POW Middleware', function() {

  after(function(done) {
    redis.flushdb(done);
  });

  describe('#getPOWMiddleware', function() {
    let challenge = '2db77b11eab714c46febb51a78d56d9b34b306d6fc46aa6e6e25a92b48eff4bf';
    let target = '00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    let challenge2 = '4fccbb094116bf90e8dcea7e2b531b9a52574737a6cab9e77e2e5599fd35eb5b';
    let target2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    let unknownChallenge = '328bfdaa0d2bf6c3c6495f06ffc2087e0b092fa534f1dea699b88f11b0082ab2';

    before(function() {
      redis.hset('contact-stats', 'count', 0);
      redis.set('contact-' + challenge, target, 'EX', 3600);
      redis.set('contact-' + challenge2, target2, 'EX', 3600);
    });

    it('will get invalid pow error', function(done) {
      let middleware = pow.getPOWMiddleware(redis);

      let req = {
        headers: {
          'x-challenge': challenge,
          'x-challenge-nonce': '0xdd170bf2'
        }
      };
      let res = {};

      middleware(req, res, function(err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Invalid proof of work');
        done();
      });

    });

    it('will get unknown challenge error', function(done) {
      let middleware = pow.getPOWMiddleware(redis);

      let req = {
        headers: {
          'x-challenge': unknownChallenge,
          'x-challenge-nonce': '0xdd170bf2'
        }
      };
      let res = {};

      middleware(req, res, function(err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Challenge not found');
        done();
      });

    });

    it('will increment count by one and remove challenge', function(done) {
      let middleware = pow.getPOWMiddleware(redis);

      let req = {
        headers: {
          'x-challenge': challenge2,
          'x-challenge-nonce': '0xdd170bf2'
        }
      };
      let res = {};

      middleware(req, res, function(err) {
        if (err) {
          return done(err);
        }

        redis.hgetall('contact-stats', function(err, stats) {
          if (err) {
            return done(err);
          }
          expect(stats.count).to.equal('1');

          redis.get('contact-' + challenge2, function(err, target) {
            if (err) {
              return done(err);
            }
            expect(target).to.equal(null);
            done();
          });
        });
      });

    });
  });

  describe('#checkInitTarget', function() {
    const sandbox = sinon.sandbox.create();
    beforeEach(function() {
      redis.del('contact-stats');
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('will init target if not set', function(done) {
      sandbox.stub(pow, 'initTarget').callsArg(1);
      pow.checkInitTarget(redis, (err) => {
        if (err) {
          return done(err);
        }
        expect(pow.initTarget.callCount).to.equal(1);
        done();
      });
    });
  });

  describe('#initTarget', function() {
    it('will set target to initial values', function(done) {
      const initialTarget = 'fffffffffffffffffffffffffffffff' +
            'fffffffffffffffffffffffffffffffff';
      pow.initTarget(redis, (err) => {
        if (err) {
          return done(err);
        }
        redis.hgetall('contact-stats', (err, stats) => {
          if (err) {
            return done(err);
          }
          expect(stats.count).to.equal('0');
          expect(stats.timestamp).to.equal('0');
          expect(stats.target).to.equal(initialTarget);
          done();
        });
      });
    });
  });

  describe('#getTarget', function() {
    let beginTime = 0;
    let clock = null;
    const count = 1000;
    const startTarget = '0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const moreTarget = '00008020c470b2c58f96b6655747ba7ec17c0bbf25f0299e34081a55c1a88168';
    const lessTarget = '000200831243a46f8b7e22f09add3b84e6593ad9c5aea066e841726623f65458';

    const sandbox = sinon.sandbox.create();

    beforeEach(function() {
      clock = sandbox.useFakeTimers();
      beginTime = Date.now();
      redis.hset('contact-stats', 'timestamp', beginTime);
      redis.hset('contact-stats', 'count', count);
      redis.hset('contact-stats', 'target', startTarget);
    });

    afterEach(() => {
      sandbox.restore();
      clock.restore();
    });

    it('it will adjust the difficulty (less)', function(done) {
      const opts = {
        retargetPeriod: 1000,
        retargetCount: 2000
      };
      clock.tick(1001);
      pow.getTarget(redis, opts, function(err, target) {
        if (err) {
          return done(err);
        }
        expect(target).to.equal(lessTarget);
        redis.hgetall('contact-stats', (err, stats) => {
          expect(parseInt(parseInt(stats.timestamp))).to.equal(Date.now());
          expect(parseInt(stats.count)).to.equal(0);
          done();
        });
      });
    });

    it('it will adjust the difficulty (more)', function(done) {
      const opts = {
        retargetPeriod: 1000,
        retargetCount: 500
      };
      clock.tick(1001);
      pow.getTarget(redis, opts, function(err, target) {
        if (err) {
          return done(err);
        }
        expect(target).to.equal(moreTarget);
        redis.hgetall('contact-stats', (err, stats) => {
          expect(parseInt(parseInt(stats.timestamp))).to.equal(Date.now());
          expect(parseInt(stats.count)).to.equal(0);
          done();
        });
      });
    });

    it('will not adjust the difficulty', function(done) {
      const opts = {
        retargetPeriod: 1000,
        retargetCount: 500
      };
      clock.tick(999);
      pow.getTarget(redis, opts, function(err, target) {
        if (err) {
          return done(err);
        }
        expect(target).to.equal(startTarget);
        redis.hgetall('contact-stats', (err, stats) => {
          expect(parseInt(stats.timestamp)).to.equal(beginTime);
          expect(parseInt(stats.count)).to.equal(count);
          done();
        });
      });
    });

    it('will adjust from init stats', function(done) {
      redis.hset('contact-stats', 'timestamp', 0);
      redis.hset('contact-stats', 'count', 0);
      redis.hset('contact-stats', 'target', MAX);
      const opts = {
        retargetPeriod: 1000,
        retargetCount: 500
      };
      clock.tick(1504182357109);
      pow.getTarget(redis, opts, function(err, target) {
        if (err) {
          return done(err);
        }
        expect(target).to.equal('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        redis.hgetall('contact-stats', (err, stats) => {
          expect(stats.timestamp).to.equal('1504182357109');
          expect(stats.count).to.equal('0');
          done();
        });
      });

    });

  });

  describe('#getChallenge', function() {
    let beginTime = 0;
    let clock = null;
    const count = 1000;
    const startTarget = '0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const sandbox = sinon.sandbox.create();
    const opts = {
      retargetPeriod: 1000,
      retargetCount: 500
    };

    beforeEach(function() {
      clock = sandbox.useFakeTimers();
      beginTime = Date.now();
      redis.hset('contact-stats', 'timestamp', beginTime);
      redis.hset('contact-stats', 'count', count);
      redis.hset('contact-stats', 'target', startTarget);
    });

    afterEach(() => {
      sandbox.restore();
      clock.restore();
    });

    it('will create a new challenge', function(done) {
      pow.getChallenge(redis, opts, function(err, data) {
        if (err) {
          return done(err);
        }
        expect(data.challenge.length).to.equal(32 * 2);
        expect(data.target).to.equal(startTarget);
        done();
      });
    });

    it('will handle error from getTarget', function(done) {
      sandbox.stub(pow, 'getTarget').callsArgWith(2, new Error('test'));
      pow.getChallenge(redis, opts, function(err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('test');
        done();
      });
    });

    it('will handle error from db', function(done) {
      sandbox.stub(redis, 'set').callsArgWith(4, new Error('test'));
      pow.getChallenge(redis, opts, function(err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('test');
        done();
      });
    });

  });

});
