'use strict';

const ms = require('ms');

module.exports = function SchemaOptionsPlugin(schema, options) {
  options = options || {};

  Object.keys(module.exports.OPTIONS).forEach(function(key) {
    schema.set(key, module.exports.OPTIONS[key]);
  });

  Object.keys(options).forEach(function(key) {
    schema.set(key, options[key]);
  });
};

module.exports.OPTIONS = process.env.NODE_ENV !== 'production' ? {} : {
  safe: {
    j: 0, // no journaling
    w: 2, // safe if written to 2 replicas
    wtimeout: ms('20s')
  }
};
