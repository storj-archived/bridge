'use strict';

var assert = require('assert');
const Adapter = require('./adapters');
const AuditInterface = require('./auditinterface');

var config = require('../config')(process.env.NODE_ENV || 'devel').audits;
var type = config.adapter.type;
delete config.adapter.type;

module.exports.service = function() {
  assert(type);
  return new Adapter[type].service(config);
};

module.exports.interface = function() {
  assert(type);
  assert(interface instanceof AuditInterface);
  return new Adapter[type].interface(config);
}
