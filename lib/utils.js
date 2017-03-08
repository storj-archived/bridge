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
    if (!this._openBracketWritten) {
      this.queue('[');
    }
    this.queue(']');
    this.queue(null);
  });
};

/**
 * Will expand JSON strings into objects
 * @param {Object|String} - A string or object with potential JSON strings
 */
module.exports.recursiveExpandJSON = function(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch(e) {
      // noop
    }
  }
  if (typeof value === 'object') {
    for (let prop in value)  {
      value[prop] = module.exports.recursiveExpandJSON(value[prop]);
    }
  }
  return value;
};
