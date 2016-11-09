/**
 * @module storj-bridge/utils
 */

'use strict';

var through = require('through');

/**
 * Returns a transform stream that wraps objects written to it
 * in proper JSON array string
 */
module.exports.createArrayFormatter = function(transformer) {
  return through(function(entry) {
    if (!this._openBracketWritten) {
      this.queue('[');
      this._openBracketWritten = true;
    }

    if (this._needsPrecedingComma) {
      this.queue(',');
    } else {
      this._needsPrecedingComma = true;
    }

    this.queue(JSON.stringify(transformer(entry)));
  }, function() {
    this.queue(']');
    this.queue(null);
  });
};
