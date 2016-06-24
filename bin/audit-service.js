#!/usr/bin/env node
'use strict';

const AuditService = require('../lib/audit');
const Config = require('../lib/config')(process.env.NODE_ENV || 'devel').audits;

new AuditService(Config);
