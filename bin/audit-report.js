#!/usr/bin/env node
'use strict';

const fs = require('fs');
const async = require('async');
const crypto = require('crypto');
const Config = require('../lib/config');
const program = require('commander');
const storj = require('storj-lib');
const Storage = require('storj-service-storage-models');
const complex = require('storj-complex');
const mkdirp = require('mkdirp');
const path = require('path');
const through2 = require('through2');
const levelup = require('levelup');
const leveldown = require('leveldown');
const logger = require('../lib/logger');
const assert = require('assert');

program
  .version('0.0.1')
  .option('-o, --outputdir <path_to_outputdir>', 'path to where shards were saved')
  .parse(process.argv);

const DOWNLOAD_DIR = program.outputdir;
assert(path.isAbsolute(DOWNLOAD_DIR), 'outputdir is expected to be absolute path');

const db = levelup(leveldown(path.resolve(DOWNLOAD_DIR, 'statedb')));

function closeProgram() {
  db.close();
}

const MIN_KEY = Buffer.from('0000000000000000000000000000000000000000', 'hex');
const MAX_KEY = Buffer.from('ffffffffffffffffffffffffffffffffffffffff', 'hex');

const stream = db.createReadStream({
  gte: MIN_KEY,
  lte: MAX_KEY
});

console.log('NodeID, Audit Success Percentage, Audit Success Shards, Audit Total Shards, Cheater');

stream.on('data', function(data) {
  const nodeID = data.key.toString('hex');
  const results = JSON.parse(data.value.toString('utf8'));

  let total = 0;
  let success = 0;

  for (var shardHash in results) {
    total++;
    if (results[shardHash]) {
      success++;
    }
  }
  let percentage = 0;
  if (total > 0) {
    percentage = success / total * 100;
  }
  const cheater = (percentage < 50 && total > 0);
  console.log('%s, %s, %s, %s, %s', nodeID, percentage.toFixed(0), success, total, cheater);
})

stream.on('error', function (err) {
  console.error(err);
})

stream.on('close', function () {})
stream.on('end', function () {
  closeProgram();
})
