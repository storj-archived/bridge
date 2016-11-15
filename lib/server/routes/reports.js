'use strict';

const Router = require('./index');
const log = require('../../logger');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;

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
ReportsRouter.prototype._definitions = function() {
  return [
    ['POST', '/reports/exchanges', this.createExchangeReport.bind(this)]
  ];
};

module.exports = ReportsRouter;
