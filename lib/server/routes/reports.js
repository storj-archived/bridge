'use strict';

const Router = require('./index');
const log = require('../../logger');
const middleware = require('storj-service-middleware');
const farmerMiddleware = require('../middleware/farmer-auth');
const rawBody = require('../middleware/raw-body');
const errors = require('storj-service-error-types');
const StorageModels = require('storj-service-storage-models');
const points = StorageModels.constants.POINTS;
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
  const isUser = (req.headers['authorization'] !== undefined ||
                  req.headers['x-pubkey'] !== undefined);
  const isFarmer = (req.headers['x-node-id'] !== undefined);

  if (isUser) {
    this.userAuthMiddlewares[0](req, res, (err) => {
      if (err) {
        return next(err);
      }
      this.userAuthMiddlewares[1](req, res, next);
    });
  } else if (isFarmer) {
    rawBody(req, res, (err) => {
      if (err) {
        return next(err);
      }
      farmerMiddleware.authFarmer(req, res, next)
    });
  } else {
    next(new errors.NotAuthorizedError('No authentication strategy detected'));
  }
};

ReportsRouter.prototype.updateReputation = function(nodeID, points) {
  this.storage.models.Contact.findOne({_id: nodeID}, (err, contact) => {
    if (err || !contact) {
      this._logger.warn('updateReputation: Error trying to find contact ' +
                        ' %s, reason: %s', nodeID, err.message);
      return;
    }
    contact.recordPoints(points).save((err) => {
      if (err) {
        this._logger.warn('updateReputation: Error saving contact ' +
                          ' %s, reason: %s', nodeID, err.message);
      };
    });;
  });
}

ReportsRouter.prototype.validateExchangeReport = function(report) {
  if (!Number.isFinite(report.exchangeStart)) {
    return false;
  }
  if (!Number.isFinite(report.exchangeEnd)) {
    return false;
  }

  if (report.exchangeResultCode !== 1100 ||
      report.exchangeResultCode !== 1000) {
    return false;
  }

  const validMessages = [
    'FAILED_INTEGRITY',
    'SHARD_DOWNLOADED',
    'SHARD_UPLOADED',
    'DOWNLOAD_ERROR',
    'TRANSFER_FAILED'
  ];

  if (!validMessages.includes(report.exchangeResultMessage)) {
    return false;
  }

  return true;
}

/**
 * Creates an exchange report
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
ReportsRouter.prototype.createExchangeReport = function(req, res, next) {
  const token = req.body.token;

  this.storage.models.StorageEvent.findOne({token: token}, (err, event) => {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!event) {
      return next(new errors.NotFoundError('Storage event not found'));
    }

    const report = {
      exchangeStart: req.body.exchangeStart,
      exchangeEnd: req.body.exchangeEnd,
      exchangeResultCode: req.body.exchangeResultCode,
      exchangeResultMessage: req.body.exchangeResultMessage
    };

    if (!this.validateExchangeReport(report)) {
      return next(new errors.BadRequestError('Invalid exchange report'));
    }

    const isClientReport = (event.client === req.user.id ||
                            event.client === req.farmerNodeID);
    const isFarmerReport = (event.farmer === req.farmerNodeID);

    if (!isClientReport && !isFarmerReport) {
      return next(new errors.NotAuthorized('Not authorized to report'));
    }

    let modified = false;

    if (isClientReport && !event.clientReport) {
      modified = true;
      event.clientReport = report;
      if (Number(req.body.exchangeResultCode) === 1000) {
        event.success = true;
        this.updateReputation(event.farmer, points.TRANSFER_SUCCESS);
      } else {
        this.updateReputation(event.farmer, points.TRANSFER_FAILURE);
      }
    } else if (isFarmerReport && !event.farmerReport) {
      modified = true;
      event.farmerReport = report;
    }

    if (modified) {
      event.save((err) => {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        // Kick off mirroring if needed
        self._handleExchangeReport({
          dataHash: req.body.dataHash,
          exchangeResultMessage: req.body.exchangeResultMessage
        }, event, (err) => {
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
ReportsRouter.prototype._handleExchangeReport = function(report, prevEvent, callback) {
  const {dataHash, exchangeResultMessage} = report;

  switch (exchangeResultMessage) {
    case 'MIRROR_SUCCESS':
    case 'SHARD_UPLOADED':
    case 'DOWNLOAD_ERROR':
      this._triggerMirrorEstablish(constants.M_REPLICATE, dataHash, prevEvent, callback);
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

ReportsRouter.prototype._createStorageEvent = function(token, event, farmer) {
  const StorageEvent = this.storage.models.StorageEvent;

  const storageEvent = new StorageEvent({
    token: token,
    user: null,
    client: event.farmer, // farmer that already has the mirror
    farmer: farmer.nodeID, // farmer storing the new mirror
    timestamp: Date.now(),
    downloadBandwidth: 0,
    storage: event.storage,
    shardHash: event.shardHash,
    success: false
  });

  storageEvent.save((err) => {
    if (err) {
      this._logger.warn('_createStorageEvent: Error saving event, ' +
                        'reason: %s', err.message);
    };
  });;
};

/**
 * Loads some mirrors for the hash and establishes them
 * @private
 */
ReportsRouter.prototype._triggerMirrorEstablish = function(n, hash, event, done) {
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
      self._createStorageEvent(token, prevEvent, farmer);

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
    ['POST', '/reports/exchanges', this.getLimiter(limiter(1000)), this.authMiddleware.bind(this),
     this.createExchangeReport.bind(this)]
  ];
};

module.exports = ReportsRouter;
