/**
 * @module metadisk/server/middleware/rawbody
 */

'use strict';

const concat = require('concat-stream');

module.exports = function rawbody(req, res, next) {
  req.pipe(concat(function(data) {
    req.rawbody = data.toString();

    try {
      req.body = JSON.parse(req.rawbody);
    } catch (err) {
      req.body = {};
    }

    next();
  }));
};
