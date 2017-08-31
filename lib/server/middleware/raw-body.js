'use strict';

const concat = require('concat-stream');

module.exports = function rawbody(req, res, next) {
  // Do not buffer the request body for file uploads
  if (req.get('Content-Type') === 'multipart/form-data') {
    return next();
  }

  req.pipe(concat(function(data) {
    req.rawbody = data;

    try {
      req.body = JSON.parse(req.rawbody.toString());
    } catch (err) {
      req.body = {};
    }

    next();
  }));
};
