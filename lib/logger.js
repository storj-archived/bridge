'use strict';

const Logger = require('kad-logger-json');

module.exports = (function() {
  let level = process.env.NODE_ENV === 'test' ? 0 : 3;
  let logger = Logger(level);

  if (level) {
    logger.pipe(process.stdout);
  }

  return logger;
})();
