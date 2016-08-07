'use strict';

const mongoose = require('mongoose');
// const Integer = require('mongoose-int32');
const SchemaOptions = require('../options');

const Credit = new mongoose.Schema({
  amount: {
    type: mongoose.SchemaTypes.Number,
    required: true
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    required: true,
    ref: 'User'
  }
});

module.exports = function(connection) {
  return connection.model('Credit', Credit);
};
