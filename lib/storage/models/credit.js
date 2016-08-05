const mongoose = require('mongoose');
const Integer = require('mongoose-int32');
const SchemaOptions = require('../options');

const Credit = new mongoose.Schema({
  type: Number
})

module.exports = function(connection) {
  return connection.model('Credit', Credit);
}
