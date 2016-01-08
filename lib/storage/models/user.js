/**
 * @class metadisk/models/user
 */

'use strict';

var mongoose = require('mongoose');

/**
 * Represents a user
 * @constructor
 */
var User = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  hashpass: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  }
});

module.exports = function(connection) {
  return connection.model('User', User);
};
