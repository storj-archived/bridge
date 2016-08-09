const mongoose = require('mongoose');
const Integer = require('mongoose-int32');
const SchemaOptions = require('../options');

const Debit = new mongoose.Schema({
  amount: {
    type: mongoose.SchemaTypes.Number,
    required: true
  },
  user: {
    type: mongoose.SchemaTypes.Email,
    required: true,
    ref: 'User'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

Debit.plugin(SchemaOptions, {
    read: 'secondaryPreferred'
});

module.exports = function(connection) {
  return connection.model('Debit', Debit);
};
