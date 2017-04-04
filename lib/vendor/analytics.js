'use strict';

const Analytics = require('analytics-node');
// NB: Not a private key. This same key is on bridge-gui/index.html
const API_WRITE_KEY = process.env.SEGMENT_WRITE_KEY;
const devOptions = { flushAt: 1 };
const prodOptions = {};

class BridgeAnalytics extends Analytics {
  constructor(key, options) {
    super(key, options);
  }

  track(dnt, msg, fn) {
    if (dnt) {
      return false;
    }
    super.track(msg, fn);
  }

  identify(dnt, msg, fn) {
    if (dnt) {
      return false;
    }
    msg.traits.email = msg.userID + '@user.storj.io';
    super.identify(msg, fn);
  }
}

var options = (process.env.NODE_ENV !== 'production') ?
  devOptions : prodOptions;

module.exports = new BridgeAnalytics(API_WRITE_KEY, options);
return module.exports;
