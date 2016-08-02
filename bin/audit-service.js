#!/usr/bin/env node
'use strict';

const AuditService = require('../lib/audit').service;
const Config = require('../lib/config')(process.env.NODE_ENV || 'devel').audits;

service();
