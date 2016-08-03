'use strict';

// NB: THIS SCRIPT CURRENTLY CALCULATES PAYOUTS FROM THE BEGINNING OF TIME
// NB: TAKE CARE TO UPDATE IT BEFORE THE NEXT PAYOUT!

const Config = require('../lib/config');
const Storage = require('../lib/storage');
const config = new Config();
const storage = new Storage(config.storage);
const cursor = storage.models.Shard.find({}).cursor();

var reports = {};

function FarmerReport(nodeId) {
  this.nodeID = nodeId;
  this.contracts = 0;
  this.storedBytes = 0;
  this.storedTime = 0;
  this.downloadedBytes = 0;
  this.downloadCount = 0;
  this.paymentDestinations = [];
  this.amountDue = 0;
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
    this.amountDue += reports[nodeID].amountDue;
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
    var downloadCost = subdoc.contract.payment_download_price * c;
    var dests = reports[subdoc.nodeID].paymentDestinations;
    var dest = subdoc.payment_destination;

    reports[subdoc.nodeID].downloadedBytes += c * subdoc.contract.data_size;
    reports[subdoc.nodeID].contracts++;
    reports[subdoc.nodeID].downloadCount += c;
    reports[subdoc.nodeID].storedBytes += subdoc.contract.data_size;
    reports[subdoc.nodeID].storedTime += contractIsActive ?
      Date.now() - subdoc.contract.store_begin :
      subdoc.contract.store_end - subdoc.contract.store_begin;
    reports[subdoc.nodeID].amountDue += subdoc.contract.payment_storage_price;
    reports[subdoc.nodeID].amountDue += downloadCost;

    if (dest && dests.indexOf(dest) === -1) {
      reports[subdoc.nodeID].paymentDestinations.push(dest);
    }
  });
});

cursor.on('close', function() {
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
});
