'use strict';

const async = require('async');
const assert = require('assert');
const scrypt = require('scrypt');
const crypto = require('crypto');
const BN = require('bn.js');

const CHALLENGE_TTL_SECONDS = 3600;
const DEFAULT_STATS = {
  count: 0,
  timestamp: Date.now(),
  target: '00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
};

function getPOWMiddleware(db) {

  return function(req, res, next) {

    const challenge = req.headers['x-challenge'];
    const nonce = req.headers['x-challenge-nonce'];

    let salt = Buffer.alloc(8, 0);
    salt.writeDoubleBE(parseInt(nonce));

    const key = 'contact-' + challenge;
    const scryptOpts = { N: Math.pow(2, 10), r: 1, p: 1 };

    db.get(key, function(err, target) {
      if (err) {
        return next(err);
      }

      if (!target) {
        return next(new Error('Challenge not found'));
      }

      scrypt.hash(challenge, scryptOpts, 32, salt, function(err, result) {
        if (err) {
          return next(err);
        }

        // Check the proof of work
        if (result.toString('hex') > target) {
          return next(new Error('Invalid proof of work'));
        }

        // Increase the count and remove the challenge
        db.hincrby('contact-stats', 'count', 1);
        db.del(key);

        return next();
      });
    });
  };
}

function getTarget(db, opts, callback) {

  const precision = 100000000;
  const precisionBN = new BN(precision);
  const retargetPeriod = opts.retargetPeriod;
  const count = opts.retargetCount;

  assert(Number.isSafeInteger(count),
         'retargetCount is expected to be a safe integer');
  assert(Number.isSafeInteger(retargetPeriod),
         'retargetPeriod is expected to be a safe integer');

  db.hgetall('contact-stats', function(err, stats) {
    if (err) {
      return callback(err);
    }

    if (!stats) {
      stats = DEFAULT_STATS;
    } else if (!Number.isSafeInteger(parseInt(stats.count)) ||
               !Number.isSafeInteger(parseInt(stats.timestamp))) {
      // TODO fix this case
      stats = DEFAULT_STATS;
    }

    const now = Date.now();
    const actual = parseInt(stats.count) || 1000;
    const timestamp = parseInt(stats.timestamp);

    if (now > timestamp + retargetPeriod) {
      const timeDelta = now - timestamp;
      const expectedRatio = retargetPeriod / count;
      const actualRatio = timeDelta / actual;

      const adjustmentAmount = actualRatio / expectedRatio;

      const adjustment = new BN(adjustmentAmount * precision);

      const target = new BN(stats.target, 16);
      const newTarget = target.mul(adjustment).div(precisionBN).toString(16, 32);

      async.series([
        (next) => {
          db.hset('contact-stats', 'target', newTarget, next);
        },
        (next) => {
          db.hset('contact-stats', 'timestamp', now, next);
        },
        (next) => {
          db.hset('contact-stats', 'count', 0, next);
        },
      ], (err) => {
        if (err) {
          return callback(err);
        }
        callback(null, newTarget);
      });

    } else {
      callback(null, stats.target);
    }

  });

}

function getChallenge(db, opts, callback) {
  module.exports.getTarget(db, opts, function(err, target) {
    if (err) {
      return callback(err);
    }

    const challenge = crypto.randomBytes(32).toString('hex');
    const key = 'contact-' + challenge;

    db.set(key, target, 'EX', CHALLENGE_TTL_SECONDS, function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, {
        challenge: challenge,
        target: target
      });
    });
  });
}

module.exports = {
  getChallenge: getChallenge,
  getTarget: getTarget,
  getPOWMiddleware: getPOWMiddleware
};
