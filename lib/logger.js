/**
 * @module storj-bridge/logger
 */

'use strict';

const Logger = require('kad-logger-json');
const config = require('./config')(process.env.NODE_ENV);
const CONSTANTS = require('./constants');

/* istanbul ignore next */
module.exports = (function() {
  let level;

  if (process.env.NODE_ENV === 'test') {
    level = CONSTANTS.LOG_LEVEL_NONE;
  } else {
    level = process.env.LOG_LEVEL || config.logger.level;
  }

  let logger = Logger(level);

  if (level) {
    logger.pipe(process.stdout);
  }

  return logger;
})();
