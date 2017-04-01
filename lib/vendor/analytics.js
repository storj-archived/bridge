const Analytics = require('analytics-node');
// NB: Not a private key. This same key is on bridge-gui/index.html
const API_WRITE_KEY = process.env.SEGMENT_WRITE_KEY;
const devOptions = { flushAt: 1 };
const prodOptions = {};

if (process.env.NODE_ENV !== 'production') {
  module.exports = new Analytics(API_WRITE_KEY, devOptions);
}
else {
  module.exports = new Analytics(API_WRITE_KEY, prodOptions);
}
return module.exports;
