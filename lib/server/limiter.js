'use strict';

const log = require('../logger');
const errors = require('storj-service-error-types');
const tmpl = '{"rate_limited": {"url": "%s", "method": "%s", "ip": "%s"}}';

module.exports.DEFAULTS = (total=1000, expire=1000*60) => {
  return {
    lookup: function(req) {
      return [req.headers['x-forwarded-for'] || req.connection.remoteAddress, req.route.path, req.method];
    },
    onRateLimited: function(req, res, next) {
      log.info(tmpl,
               req.originalUrl,
               req.method,
               req.headers['x-forwarded-for'] || req.connection.remoteAddress);
      return next(new errors.RateLimited('Too Many Requests'));
    },
    total,
    expire
  };
};
