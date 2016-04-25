/**
 * @module storj-bridge/server/middleware/error-handler
 */

'use strict';

const log = require('../../logger');

module.exports = function errorhandler(err, req, res, next) {
  if (err) {
    log.error('request error: %s', err.message);
    log.error(err.stack);

    return res.status(
      err.code ? (err.code > 500 ? 400 : err.code) : 500
    ).send({ error: err.message });
  }

  next();
};
