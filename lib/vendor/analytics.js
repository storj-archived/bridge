const Analytics = require('analytics-node');
// NB: Not a private key. This same key is on bridge-gui/index.html
const API_WRITE_KEY = process.env.SEGMENT_WRITE_KEY;
const devOptions = { flushAt: 1 };
const prodOptions = {};
var options;

if (process.env.NODE_ENV !== 'production') {
  options = devOptions;
}
else {
  options = prodOptions;
}

module.exports = new Analytics(API_WRITE_KEY, options);
return module.exports;
