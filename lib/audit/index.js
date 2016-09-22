'use strict';

var assert = require('assert');
const Adapter = require('./adapters');
const AuditInterface = require('./abstractauditinterface');

var config = require('../config')(process.env.NODE_ENV || 'devel').audits;
var type = config.adapter.type;
delete config.adapter.type;

module.exports.service = function(opts) {
  var adapterService = new Adapter[type].service(opts || config);
  assert(type);
  return adapterService;
};

module.exports.interface = function(opts) {
  var adapterInterface = new Adapter[type].interface(opts || config);
  assert(type);
  assert(adapterInterface instanceof AuditInterface);
  return adapterInterface;
}
