'use strict';

// NB: THIS SCRIPT CURRENTLY CALCULATES PAYOUTS FROM THE BEGINNING OF TIME
// NB: TAKE CARE TO UPDATE IT BEFORE THE NEXT PAYOUT!

const log = require('../lib/logger');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const Config = require('../lib/config');
const Storage = require('../lib/storage');
const config = new Config(process.env.NODE_ENV);
const storage = new Storage(config.storage);
const cursor = storage.models.Shard.find({}).cursor();
const csvOutPath = process.argv[2];

if (!csvOutPath) {
  log.info('NO OUT PATH SUPPLIED FOR CSV, WILL PRINT TO CONSOLE');
}

var reports = {};

function FarmerReport(nodeId) {
  this.nodeID = nodeId;
  this.contracts = 0;
  this.storedBytes = 0;
  this.storedTime = 0;
  this.downloadedBytes = 0;
  this.downloadCount = 0;
  this.paymentDestination = '';
  this.gigabyteHours = 0;
  this.gibibyteHours = 0;
}

function TotalReport(reports) {
  FarmerReport.call(this, null);

  delete this.nodeID;
  delete this.paymentDestinations;

  this.farmers = 0;

  for (let nodeID in reports) {
    this.farmers++;
    this.contracts += reports[nodeID].contracts;
    this.storedBytes += reports[nodeID].storedBytes;
    this.storedTime += reports[nodeID].storedTime;
    this.downloadedBytes += reports[nodeID].downloadedBytes;
    this.downloadCount += reports[nodeID].downloadCount;
    this.gigabyteHours += reports[nodeID].gigabyteHours;
    this.gibibyteHours += reports[nodeID].gibibyteHours;
  }
}

cursor.on('data', function(doc) {

  function getDownloadCountForContract(nodeId) {
    var count = 0;

    doc.meta.forEach(function(subdoc) {
      if (subdoc.nodeID !== nodeId) {
        return false;
      }

      count = subdoc.meta ? (subdoc.meta.downloadCount || 0) : 0;
    });

    return count;
  }

  doc.contracts.forEach(function(subdoc) {
    if (subdoc.nodeID.length !== 40) {
      return false;
    }

    if (!reports[subdoc.nodeID]) {
      reports[subdoc.nodeID] = new FarmerReport(subdoc.nodeID);
    }

    if (!subdoc.contract) {
      return false;
    }

    var c = getDownloadCountForContract(subdoc.nodeID);
    var contractIsActive = Date.now() < subdoc.contract.store_end;
    var dest = subdoc.contract.payment_destination;

    reports[subdoc.nodeID].downloadedBytes += c * subdoc.contract.data_size;
    reports[subdoc.nodeID].contracts++;
    reports[subdoc.nodeID].downloadCount += c;
    
    var bytes = subdoc.contract.data_size;
    reports[subdoc.nodeID].storedBytes += bytes;

    var time = contractIsActive ?
      Date.now() - subdoc.contract.store_begin :
      subdoc.contract.store_end - subdoc.contract.store_begin;

    reports[subdoc.nodeID].storedTime += time;

    var hours = parseInt((time / (1000 * 60 * 60)) % 24);
    var gigabytes = bytes / (1000 * 1000 * 1000);
    var gibibytes = bytes / (1024 * 1024 * 1024);

    if (dest) {
      reports[subdoc.nodeID].paymentDestination = dest;
    }

    reports[subdoc.nodeID].gigabyteHours += gigabytes * hours;
    reports[subdoc.nodeID].gibibyteHours += gibibytes * hours;

  });
});

cursor.on('close', function() {
  if (!csvOutPath) {
    console.log('Farmer Reports:');
    console.log('---------------');
    console.log('');

    for (let report in reports) {
      console.log(reports[report]);
      console.log('');
    }

    console.log('Totals Reports:');
    console.log('---------------');
    console.log('');
    console.log(new TotalReport(reports));
    process.exit();
  }

  var writeOptions = {
    headers: [
      'Node ID',
      'Total Contracts',
      'Stored Bytes',
      'Stored Time',
      'Downloaded Bytes',
      'Download Count',
      'Payment Destination',
      'Gigabyte Hours'
    ]
  };

  function runTotalReportOutToCSV(callback) {
    var writeStream = fs.createWriteStream('totals.' + csvOutPath);
    var writer = csvWriter(writeOptions);
    var totals = new TotalReport(reports);

    writer.pipe(writeStream).on('finish', function() {
      console.log('Total report CSV written to %s', csvOutPath);
      callback();
    });

    writer.write([
      totals.nodeID || 'none',
      totals.contracts,
      totals.storedBytes,
      totals.storedTime,
      totals.downloadedBytes,
      totals.downloadCount,
      totals.paymentDestination || 'none',
      totals.gigabyteHours,
      totals.gibibyteHours
    ]);

    writer.end();
  }

  function runFarmerReportOutToCSV(callback) {
    var writeStream = fs.createWriteStream(csvOutPath);
    var writer = csvWriter(writeOptions);

    writer.pipe(writeStream).on('finish', function() {
      console.log('Farmer report CSV written to %s', csvOutPath);
      callback();
    });

    for (let report in reports) {
      writer.write([
        reports[report].nodeID || 'none',
        reports[report].contracts,
        reports[report].storedBytes,
        reports[report].storedTime,
        reports[report].downloadedBytes,
        reports[report].downloadCount,
        reports[report].paymentDestination || 'none',
        reports[report].gigabyteHours,
        reports[report].gibibyteHours
      ]);
    }

    writer.end();
  }

  runFarmerReportOutToCSV(function() {
    log.info('Farmer report written to %s', csvOutPath);

    runTotalReportOutToCSV(function() {
      log.info('Totals report written to totals.%s', csvOutPath);
      process.exit();
    });
  });
});
