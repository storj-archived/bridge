'use strict';

const kad = require('storj/node_modules/kad');

/**
 * Logs messages to the console
 * @constructor
 * @extends {kad.Logger}
 * @param {Number} level - 0: none, 1: errors, 2: warnings, 3: info, 4: debug
 */
function Logger(level) {
  if (!(this instanceof Logger)) {
    return new Logger(level);
  }

  if (process.env.NODE_ENV === 'test') {
    level = 0;
  }

  kad.Logger.call(this, level || 3, 'METADISK');
}

require('util').inherits(Logger, kad.Logger);

module.exports = Logger;
