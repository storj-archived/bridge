'use strict';

const Router = require('./index');
const log = require('../../logger');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;
const BucketsRouter = require('./buckets');
const constants = require('../../constants');
const async = require('async');

/**
 * Handles endpoints for reporting
 * @constructor
 * @extends {Router}
 */
function ReportsRouter(options) {
  if (!(this instanceof ReportsRouter)) {
    return new ReportsRouter(options);
  }

  Router.apply(this, arguments);
}

inherits(ReportsRouter, Router);

/**
 * Creates an exchange report
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
ReportsRouter.prototype.createExchangeReport = function(req, res, next) {
  const self = this;
  var exchangeReport = new this.storage.models.ExchangeReport(req.body);
  var projection = {
    hash: true,
    contracts: true
  };

  this.storage.models.Shard.find({
    hash: exchangeReport.dataHash
  }, projection, function(err, shards) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!shards || !shards.length) {
      return next(new errors.NotFoundError('Shard not found for report'));
    }

    // TODO: Add signature/identity verification

    // NB: Kick off mirroring if needed
    self._handleExchangeReport(exchangeReport, () => null);
    log.info('received exchange report');
    exchangeReport.save(function(err) {
      if (err) {
        return next(new errors.BadRequestError(err.message));
      }

      log.info('exchange report saved');
      res.status(201).send({});
    });
  });
};

/**
 * @private
 */
ReportsRouter.prototype._handleExchangeReport = function(report, callback) {
  const {dataHash, exchangeResultMessage} = report;

  switch (exchangeResultMessage) {
    case 'MIRROR_SUCCESS':
    case 'SHARD_UPLOADED':
      this._triggerMirrorEstablish(constants.M_REPLICATE, dataHash, callback);
      break;
    default:
      callback(new Error('Invalid report result - cannot handle'));
  }
};

/**
 * Loads some mirrors for the hash and establishes them
 * @private
 */
ReportsRouter.prototype._triggerMirrorEstablish = function(n, hash, done) {
  const self = this;

  function _getMirrors(callback) {
    self.storage.models.Mirror.find({ shardHash: hash }, callback);
  }

  function _getMirrorCandidate(mirrors, callback) {
    let established = [], available = [];

    mirrors.forEach(
      (m) => m.isEstablished ? established.push(m) : available.push(m)
    );

    if (available.length === 0) {
      return callback(new Error('No available mirrors'));
    }

    if (established.length >= n) {
      return callback(new Error('Auto mirroring limit is reached'));
    }

    callback(null, available.shift());
  }

  function _getRetrievalTokenFromFarmer(mirror, callback) {
    self.contracts.load(hash, (err, item) => {
      if (err) {
        return callback(err);
      }

      let farmers = Object.keys(item.contracts);
      let pointer = null;
      let test = () => farmers.length !== 0 && pointer !== null;

      async.until(test, (done) => {
        self.getContactById(farmers.shift(), (err, contact) => {
          if (err) {
            return done();
          }

          self.network.getRetrievalPointer(
            contact,
            item.getContract(contact),
            (err, result) => {
              pointer = result;
              done();
            }
          );
        });
      }, () => {
        if (!pointer) {
          return callback(new Error('Failed to get pointer'));
        }

        callback(null, pointer, mirror.contact);
      });
    });
  }

  function _establishMirror(source, destination, callback) {
    self.network.getMirrorNodes([source], [destination], callback);
  }

  async.waterfall([
    _getMirrors,
    _getMirrorCandidate,
    _getRetrievalTokenFromFarmer,
    _establishMirror
  ], done);
};

/**
 * @private
 */
ReportsRouter.prototype.getContactById = BucketsRouter.prototype.getContactById;

/**
 * @private
 */
ReportsRouter.prototype._definitions = function() {
  return [
    ['POST', '/reports/exchanges', middleware.rawbody,
     this.createExchangeReport.bind(this)]
  ];
};

module.exports = ReportsRouter;
