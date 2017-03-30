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
 * Will get a timestamp integer from a string or number
 * argument, including ISO formatted strings.
 * @param {*} - The variable to parse
 */
module.exports.parseTimestamp = function(arg) {
  let startDate = new Date(arg);
  if (Number.isInteger(startDate.getTime())) {
    return startDate.getTime();
  }
  const startDateTimestamp = parseInt(arg);
  if (Number.isInteger(startDateTimestamp)) {
    startDate = new Date(startDateTimestamp);
  }
  if (Number.isInteger(startDate.getTime())) {
    return startDate.getTime();
  }
  return 0;
};

/**
 * Will check to see if a variable is valid MongoDB object id
 * @param {*} - The variable to test
 */
module.exports.isValidObjectId = function(id) {
  if (typeof id !== 'string') {
    return false;
  }
  return /^[0-9a-fA-F]{24}$/.test(id);
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
