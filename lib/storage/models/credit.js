const mongoose = require('mongoose');
const Integer = require('mongoose-int32');
const SchemaOptions = require('../options');

const Credit = new mongoose.Schema({

})

Credit.plugin(SchemaOptions, {
    read: 'secondaryPreferred'
})

module.exports = function(connection) {
  return connection.model('Credit', Credit);
}
