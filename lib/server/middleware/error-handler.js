/**
 * @module metadisk/server/middleware/error-handler
 */

'use strict';

module.exports = function errorhandler(err, req, res, next) {
  if (err) {
    res.status(err.code || 500).send({ error: err.message });
  }
};
