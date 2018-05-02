'use strict';

const Router = require('./index');
const log = require('../../logger');
const middleware = require('storj-service-middleware');
const farmerMiddleware = require('../middleware/farmer-auth');
const rawBody = require('../middleware/raw-body');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;
const BucketsRouter = require('./buckets');
const constants = require('../../constants');
const async = require('async');
const storj = require('storj-lib');
const limiter = require('../limiter').DEFAULTS;
const utils = require('../../utils');

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

  this.getLimiter = middleware.rateLimiter(options.redis);
  this.userAuthMiddlewares = middleware.authenticate(this.storage);
}

inherits(ReportsRouter, Router);

ReportsRouter.prototype.authMiddleware = function(req, res, next) {
  /* jshint sub:true */
  const isUser = (req.headers['authorization'] !== undefined ||
                  req.headers['x-pubkey'] !== undefined);
  const isFarmer = (req.headers['x-node-id'] !== undefined);

  // These rely on rawBody being already handled in the middleware
  if (isUser) {
    this.userAuthMiddlewares[1](req, res, next);
  } else if (isFarmer) {
    farmerMiddleware.authFarmer(req, res, next);
  } else {
    next(new errors.NotAuthorizedError('No authentication strategy detected'));
  }
};

ReportsRouter.prototype.compat = function(req, res, next) {
  // If the exchange report does not have a token, we can
  // assume that it's not in the new SIP9 format, and will be
  // handled temporarily for backwards compatibility.
  if (!req.body.token) {
    this.createExchangeReportCompat(req, res, next);
  } else {
    next();
  }
};

ReportsRouter.prototype.validateExchangeReport = function(report) {
  if (!Number.isFinite(report.exchangeStart)) {
    return false;
  }
  if (!Number.isFinite(report.exchangeEnd)) {
    return false;
  }

  if (report.exchangeResultCode !== 1100 &&
      report.exchangeResultCode !== 1000) {
    return false;
  }

  // TODO: Check timestamp is reasonable

  const validMessages = [
    'FAILED_INTEGRITY',
    'SHARD_DOWNLOADED',
    'SHARD_UPLOADED',
    'DOWNLOAD_ERROR',
    'TRANSFER_FAILED',
    'MIRROR_SUCCESS'
  ];

  if (!validMessages.includes(report.exchangeResultMessage)) {
    return false;
  }

  return true;
};

/**
 * Creates an exchange report for compatibility purposes only, this method can
 * be removed and return a bad request error once SIP9 is fully deployed.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
ReportsRouter.prototype.createExchangeReportCompat = function(req, res, next) {
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

    // NB: Kick off mirroring if needed
    const dataBytes = shards[0].contracts[0].data_size;
    self._handleExchangeReport(exchangeReport, dataBytes, (err) => {
      /* istanbul ignore next */
      if (err) {
        return log.warn(err.message);
      }
    });
    exchangeReport.save(function(err) {
      if (err) {
        return next(new errors.BadRequestError(err.message));
      }

      res.status(201).send({});
    });
  });
};

/**
 * Creates an exchange report
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
ReportsRouter.prototype.createExchangeReport = function(req, res, next) {
  const token = req.body.token;

  /* jshint maxstatements: 30, maxcomplexity: 15 */
  this.storage.models.StorageEvent.findOne({token: token}, (err, event) => {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!event) {
      return next(new errors.NotFoundError('Storage event not found'));
    }

    // TODO: Check that event isn't closed for reports

    const report = {
      exchangeStart: req.body.exchangeStart,
      exchangeEnd: req.body.exchangeEnd,
      exchangeResultCode: req.body.exchangeResultCode,
      exchangeResultMessage: req.body.exchangeResultMessage
    };

    if (!this.validateExchangeReport(report)) {
      return next(new errors.BadRequestError('Invalid exchange report'));
    }

    const isClientReport = req.user ?
          (event.client === req.user._id) : req.farmerNodeID ?
          (event.client === req.farmerNodeID) : false;
    const isFarmerReport = req.farmerNodeID ?
          (event.farmer === req.farmerNodeID) : false;

    if (!isClientReport && !isFarmerReport) {
      return next(new errors.NotAuthorizedError('Not authorized to report'));
    }

    let modified = false;

    const hasClientReport = event.clientReport ?
          !!event.clientReport.exchangeResultCode : false;
    const hasFarmerReport = event.farmerReport ?
          !!event.farmerReport.exchangeResultCode : false;

    if (isClientReport && !hasClientReport) {
      modified = true;
      event.clientReport = report;
    } else if (isFarmerReport && !hasFarmerReport) {
      modified = true;
      event.farmerReport = report;
    }

    if (modified) {
      event.save((err) => {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        // Kick off mirroring if needed
        const dataBytes = event.storage;
        this._handleExchangeReport({
          dataHash: req.body.dataHash,
          exchangeResultMessage: req.body.exchangeResultMessage
        }, dataBytes, (err) => {
          /* istanbul ignore next */
          if (err) {
            return log.warn(err.message);
          }
        });

        res.status(201).send({});
      });

    } else {
      res.status(200).send({});
    }

  });
};

/**
 * @private
 */
ReportsRouter.prototype._handleExchangeReport = function(report, dataBytes, callback) {
  const {dataHash, exchangeResultMessage} = report;

  switch (exchangeResultMessage) {
    case 'MIRROR_SUCCESS':
    case 'SHARD_UPLOADED':
    case 'DOWNLOAD_ERROR':
      this._triggerMirrorEstablish(constants.M_REPLICATE, dataHash, dataBytes, callback);
      break;
    default:
      callback(new Error('Exchange result type will not trigger action'));
  }
};

ReportsRouter._sortByTimeoutRate = function(a, b) {
  const a1 = a.contact.timeoutRate >= 0 ? a.contact.timeoutRate : 0;
  const b1 = b.contact.timeoutRate >= 0 ? b.contact.timeoutRate : 0;
  return (a1 === b1) ? 0 : (a1 > b1) ? 1 : -1;
};

ReportsRouter._sortByResponseTime = function(a, b) {
  const aTime = a.contact.responseTime || Infinity;
  const bTime = b.contact.responseTime || Infinity;
  return (aTime === bTime) ? 0 : (aTime > bTime) ? 1 : -1;
};

ReportsRouter.prototype._createStorageEvent = function(token,
                                                       clientNodeID,
                                                       farmerNodeID,
                                                       storage,
                                                       shardHash) {
  const StorageEvent = this.storage.models.StorageEvent;

  const storageEvent = new StorageEvent({
    token: token,
    user: null,
    client: clientNodeID, // farmer that already has the mirror
    farmer: farmerNodeID, // farmer storing the new mirror
    timestamp: Date.now(),
    downloadBandwidth: 0,
    storage: storage,
    shardHash: shardHash,
    success: false
  });

  storageEvent.save((err) => {
    if (err) {
      log.warn('_createStorageEvent: Error saving event, ' +
               'reason: %s', err.message);
    }
  });
};

/**
 * Loads some mirrors for the hash and establishes them
 * @private
 */
ReportsRouter.prototype._triggerMirrorEstablish = function(n,
                                                           hash,
                                                           dataBytes,
                                                           done) {
  const self = this;
  let item = null;

  function _loadShard(callback) {
    self.contracts.load(hash, (err, _item) => {
      if (err) {
        return callback(err);
      }
      item = _item;
      callback();
    });
  }

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

    available.sort(utils.sortByReputation);

    callback(null, available.shift());
  }

  function _getRetrievalTokenFromFarmer(mirror, callback) {
    let farmers = Object.keys(item.contracts);
    let pointer = null;
    let test = () => farmers.length === 0 || pointer !== null;
    let contact = storj.Contact(mirror.contact.toObject());

    async.until(test, (done) => {
      self.getContactById(farmers.pop(), (err, result) => {
        if (err) {
          return done();
        }

        let farmer = storj.Contact(result.toObject());

        self.network.getRetrievalPointer(
          farmer,
          item.getContract(farmer),
          (err, result) => {
            // NB: Make sure that we don't set pointer to undefined
            // instead of null that would trigger the until loop to quit
            if (err) {
              log.warn('Unable to get pointer for mirroring, reason: %s',
                       err.message);
            } else {
              pointer = result;
            }
            done();
          }
        );
      });
    }, () => {
      if (!pointer) {
        return callback(new Error('Failed to get pointer'));
      }

      let farmer = pointer.farmer;
      let token = pointer.token;
      self._createStorageEvent(token,
                               farmer.nodeID,
                               contact.nodeID,
                               dataBytes,
                               hash);

      callback(null, pointer, mirror, contact);
    });
  }

  function _establishMirror(source, mirror, contact, callback) {
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
    _loadShard,
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
    ['POST', '/reports/exchanges', this.getLimiter(limiter(1000)),
     rawBody, this.compat.bind(this), this.authMiddleware.bind(this),
     this.createExchangeReport.bind(this)]
  ];
};

module.exports = ReportsRouter;
