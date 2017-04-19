'use strict';

const log = require('../logger');
const errors = require('storj-service-error-types');

const tmpl = '{"rate_limited": {"url": "%s", "method": "%s", "ip": "%s"}}';

module.exports.DEFAULTS = {
  lookup: function(req) {
    return [req.headers['x-forwarded-for'] || req.connection.remoteAddress];
  },
  onRateLimited: function(req, res, next) {
    log.info(tmpl,
             req.originalUrl,
             req.method,
             req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    return next(new errors.RateLimited('Too Many Requests'));
  },
  total: 1000,
  expire: 1000 * 60 // 1 minutes
};
