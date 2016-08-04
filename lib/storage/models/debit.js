const mongoose = require('mongoose');
const Integer = require('mongoose-int32');
const SchemaOptions = require('../options');

const Debit = new mongoose.Schema({

})

Debit.plugin(SchemaOptions, {
    read: 'secondaryPreferred'
})

module.exports = function(connection) {
  return connection.model('Debit', Debit);
}
