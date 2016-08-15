'use strict';

const Logger = require('kad-logger-json');
const config = require('./config')(process.env.NODE_ENV);

module.exports = (function() {
  let level = process.env.LOG_LEVEL || config.logger.level;
  let logger = Logger(level);

  if (level) {
    logger.pipe(process.stdout);
  }

  return logger;
})();
