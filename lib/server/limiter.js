'use strict';

const log = require('../logger');
const errors = require('storj-service-error-types');

module.exports.DEFAULTS = {
  lookup: function(req) {
    return [req.headers['x-forwarded-for'] || req.connection.remoteAddress];
  },
  onRateLimited: function(req, res, next) {
    log.info('user rate limited', req.connection.remoteAddress);
    return next(new errors.RateLimited('Too Many Requests'));
  },
  total: 1000,
  expire: 1000 * 60 // 1 minutes
};
