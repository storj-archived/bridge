'use strict';

const Logger = require('kad-logger-json');

module.exports = (function() {
  let level = 3;
  switch(process.env.NODE_ENV) {
    case 'test':
      level = 0;
      break;
    case 'integration':
      level = 3;
      break;
  }
  let logger = Logger(level);

  if (level) {
    logger.pipe(process.stdout);
  }

  return logger;
})();
