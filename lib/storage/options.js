'use strict';

const ms = require('ms');

module.exports = process.env.NODE_ENV !== 'production' ? null : {
  safe: {
    j: 0, // no journaling
    w: 2, // safe if written to 2 replicas
    wtimeout: ms('20s')
  }
};
