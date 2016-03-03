'use strict';

const ms = require('ms');

module.exports.apply = function(schema, options) {
  options = options || {};

  Object.keys(module.exports._opts).forEach(function(key) {
    schema.set(key, module.exports._opts[key]);
  });

  Object.keys(options).forEach(function(key) {
    schema.set(key, options[key]);
  });
};

module.exports._opts = process.env.NODE_ENV !== 'production' ? {} : {
  safe: {
    j: 0, // no journaling
    w: 2, // safe if written to 2 replicas
    wtimeout: ms('20s')
  }
};
