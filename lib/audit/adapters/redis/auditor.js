'use strict';

const Async = require('async');
const Verification = require('storj').Verification;
const log = require('../../../../lib/logger');
const AuditQueue = require('./queue.js');
const Contact = require('storj').Contact;

/**
 * RedisAuditor Service
 * @constructor
 * @param {Object} queue - storage queue for scheduled audits
 * @param {Object} network - renter interface
 */

function RedisAuditor(network, storageAdapt, mongoAdapt, redisconfig, uuid) {
  this._queue = new AuditQueue(redisconfig, uuid);
  this._network = network;
  this._storage = storageAdapt;
  this._mongo = mongoAdapt;
};

RedisAuditor.prototype.get = function(callback) {
  this._queue.popReadyQueue(function(err, audit) {
    if(err) return callback(err);
    return callback(null, audit);
  });
};

RedisAuditor.prototype.awaitGet = function(callback) {
  this._queue.awaitReadyQueue(function(err, audit) {
    if(err) return callback(err);
    return callback(null, audit);
  });
};

RedisAuditor.prototype.verify = function(audit, callback) {
  var contact = null;
  var foundContact = false;
  var contactStrat = [
    checkMem.bind(this),
    checkStor.bind(this),
    checkNet.bind(this)
  ];

  Async.doWhilst(
    function getContact(next) {
      var strategy = contactStrat.shift();
      if(strategy === undefined) {
        foundContact = true;
        return next(true);
      }

      strategy(function(err, farmer) {
        if(err || farmer === null) {
          return next(null);
        }

        contact = new Contact(farmer);
        this._mongo._get(audit.hash, function(err, storageItem) {
          if(err) {
            foundContact = true;
            return next(err);
          }

          this._network.getStorageProof(
            contact,
            storageItem,
            function getProofResult(err, proof) {
              if(err) return next(null);
              var verification = new Verification(proof);
              var result = verification.verify(audit.root, audit.depth)
              var hasPassed = result[0] === result[1];
              foundContact = true;
              return next(null, hasPassed);
            }
          );
        }.bind(this));
      }.bind(this));
    }.bind(this),

    function test() {
      return foundContact === false;
    },

    function done(err, hasPassed) {
      if(err) return callback(null, audit, false);
      return callback(null, audit, hasPassed);
    }
  );

  function checkMem(cb) {
    var contact = this._network.router.getContactByNodeID(audit.id);
    if(contact === null) {
      return cb(null, null);
    } else {
      return cb(null, contact);
    }
  }

  function checkStor(cb) {
    this._storage.models.Contact.findOne(
      {_id: audit.id},
      function(err, contact) {
        if(err) {return cb(err)};
        return cb(null, contact)
      });
  }

  function checkNet(cb) {
    this._network.router.lookup('NODE', audit.id, function(err, contact) {
      if(err) {return cb(err)};
      return cb(null, contact);
    });
  }
};

RedisAuditor.prototype.commit = function(audit, hasPassed, callback) {
  this._queue.pushResultQueue(audit, hasPassed, function(err, isSuccess) {
    if(err) return callback(err);
    return callback(null, isSuccess);
  });
};

RedisAuditor.prototype.process = function(audit, nextAudit) {
  Async.waterfall([
   Async.apply(this.verify.bind(this), audit),
   this.commit.bind(this)
  ], function done(err) {
   if(err) log.error(err.message);
   return nextAudit();
  });
};

RedisAuditor.prototype.getPendingQueue = function(callback) {
  return this._queue.getPendingQueue(callback);
};

module.exports = RedisAuditor;
