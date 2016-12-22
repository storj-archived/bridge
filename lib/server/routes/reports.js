'use strict';

const Router = require('./index');
const log = require('../../logger');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;
const BucketsRouter = require('./buckets');
const constants = require('../../constants');
const async = require('async');
const storj = require('storj-lib');

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
    self._handleExchangeReport(exchangeReport, (err) => {
      /* istanbul ignore next */
      if (err) {
        return log.warn(err.message);
      }

      /* istanbul ignore next */
      log.info('exchange report triggered a mirroring operation');
    });
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
    case 'DOWNLOAD_ERROR':
      this._triggerMirrorEstablish(constants.M_REPLICATE, dataHash, callback);
      break;
    default:
      callback(new Error('Exchange result type will not trigger action'));
  }
};

ReportsRouter._sortByResponseTime = function(a, b) {
  const aTime = a.contact.responseTime || Infinity;
  const bTime = b.contact.responseTime || Infinity;
  return (aTime === bTime) ? 0 : (aTime > bTime) ? 1 : -1;
};

/**
 * Loads some mirrors for the hash and establishes them
 * @private
 */
ReportsRouter.prototype._triggerMirrorEstablish = function(n, hash, done) {
  const self = this;

  function _getMirrors(callback) {
    self.storage.models.Mirror.find({ shardHash: hash })
      .populate('contact')
      .exec(callback);
  }

  function _getMirrorCandidate(mirrors, callback) {
    let established = [], available = [];

    mirrors.forEach((m) => {
      if (!m.contact) {
        log.warn('Mirror %s is missing contact in database', m._id);
      } else if (!m.isEstablished) {
        available.push(m);
      } else {
        established.push(m);
      }
    });

    if (available.length === 0) {
      return callback(new Error('No available mirrors'));
    }

    if (established.length >= n) {
      return callback(new Error('Auto mirroring limit is reached'));
    }

    available.sort(ReportsRouter._sortByResponseTime);

    callback(null, available.shift());
  }

  function _getRetrievalTokenFromFarmer(mirror, callback) {
    self.contracts.load(hash, (err, item) => {
      if (err) {
        return callback(err);
      }

      let farmers = Object.keys(item.contracts);
      let pointer = null;
      let test = () => farmers.length === 0 || pointer !== null;
      let contact = storj.Contact(mirror.contact.toObject());

      async.until(test, (done) => {
        self.getContactById(farmers.shift(), (err, result) => {
          if (err) {
            return done();
          }

          let farmer = storj.Contact(result.toObject());

          self.network.getRetrievalPointer(
            farmer,
            item.getContract(farmer),
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

        callback(null, pointer, mirror, contact, item);
      });
    });
  }

  function _establishMirror(source, mirror, contact, item, callback) {
    self.network.getMirrorNodes(
      [source],
      [contact],
      (err) => {
        if (err) {
          return callback(err);
        }

        mirror.isEstablished = true;
        mirror.save();
        item.addContract(contact, storj.Contract(mirror.contract));
        self.contracts.save(item, callback);
      }
    );
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
