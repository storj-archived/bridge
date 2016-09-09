'use strict';


const storj = require('storj');
const expect = require('chai').expect;
const mongoose = require('mongoose');
const CONSTANTS = require('../../lib/constants');

require('mongoose-types').loadTypes(mongoose);

const CreditSchema = require('../../lib/storage/models/credit');

var Credit;
var connection;
var creditParams = {
  user: 'user1@example.com',
  paid_amount: 1000,
  invoiced_amount: 0,
  type: 'manual',
  payment_processor: 'stripe',
  created: '07/30/2016'
}

var dataObject = {
  "billingDate": 2,
  "customer": {
    "subscriptions": {
      "url": "/v1/customers/cus_97YiKPOYvPQ8Ha/subscriptions",
      "total_count": 1,
      "has_more": false,
      "data": [{
        "trial_start": null,
        "trial_end": null,
        "tax_percent": null,
        "status": "active",
        "start": 1472830106,
        "quantity": 1,
        "plan": {
          "trial_period_days": null,
          "statement_descriptor": "Storj.io account usage",
          "name": "premium",
          "livemode": false,
          "interval_count": 1,
          "interval": "month",
          "currency": "usd",
          "created": 1472738058,
          "amount": 0,
          "object": "plan",
          "id": "premium"
        },
        "livemode": false,
        "ended_at": null,
        "discount": null,
        "customer": "cus_97YiKPOYvPQ8Ha",
        "current_period_start": 1472830106,
        "current_period_end": 1475422106,
        "created": 1472830106,
        "canceled_at": null,
        "cancel_at_period_end": false,
        "application_fee_percent": null,
        "object": "subscription",
        "id": "sub_97Yi6fsBzeDW6C"
      }],
      "object": "list"
    },
    "sources": {
      "url": "/v1/customers/cus_97YiKPOYvPQ8Ha/sources",
      "total_count": 1,
      "has_more": false,
      "data": [{
        "tokenization_method": null,
        "name": null,
        "last4": "4242",
        "funding": "credit",
        "fingerprint": "DbXmpVpiNsp7lcnp",
        "exp_year": 2019,
        "exp_month": 9,
        "dynamic_last4": null,
        "cvc_check": "pass",
        "customer": "cus_97YiKPOYvPQ8Ha",
        "country": "US",
        "brand": "Visa",
        "address_zip_check": null,
        "address_zip": null,
        "address_state": null,
        "address_line2": null,
        "address_line1_check": null,
        "address_line1": null,
        "address_country": null,
        "address_city": null,
        "object": "card",
        "id": "card_18pJafHUqQsjaswpAm1uLT8b"
      }],
      "object": "list"
    },
    "shipping": null,
    "livemode": false,
    "email": "user1@example.com",
    "discount": null,
    "description": null,
    "delinquent": false,
    "default_source": "card_18pJafHUqQsjaswpAm1uLT8b",
    "currency": "usd",
    "created": 1472830106,
    "account_balance": 0,
    "object": "customer",
    "id": "cus_97YiKPOYvPQ8Ha"
  }
}

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__storj-bridge-test',
    function() {
      Credit = CreditSchema(connection);
      done();
    }
  );
});

after(function(done) {
  Credit.remove({}, function() {
    connection.close(done);
  });
});

describe('Storage/models/Credit', function() {

  describe('#create', function() {

    it('should create a credit', function() {
      Credit.create({
        user: 'user1@example.com',
        paid_amount: 1000,
        invoiced_amount: 1000,
        type: CONSTANTS.CREDIT_TYPES.AUTO,
        payment_processor: CONSTANTS.PAYMENT_PROCESSORS.STRIPE,
        paid: false
      }, {}, function(err, credit) {
        expect(err).to.not.be.instanceOf(Error);
        expect(credit).to.be.ok;
        expect(credit.created).to.be.ok;
        expect(credit.paid).to.not.be.ok;
      })
    })

    it('should not create a credit with an improper payment_processor type', function() {
      Credit.create({
        user: 'user1@example.com',
        paid_amount: 1000,
        invoiced_amount: 0,
        type: CONSTANTS.CREDIT_TYPES.AUTO,
        payment_processor: 'a;sdfwaix',
        created: '07/30/2016'
      }, {}, function(err, credit) {
        expect(err).to.be.instanceOf(Error);
        expect(credit).to.be.a('null');
        expect(err.message).to.equal('Credit validation failed');
        done();
      });
    });

    it('should create credit with a valid promo_amount', function() {
      Credit.create({
        user: 'user1@example.com',
        promo_amount: 1000,
        promo_code: 'STORJPROMO30',
        type: 'manual',
        created: '07/30/2016'
      }, {}, function(err, credit) {
        expect(err).to.not.be.instanceOf(Error);
        expect(credit).to.be.ok;
        expect(credit.promo_code).to.be.a('string');
        expect(credit).to.be.an('object');
        expect(credit.invoiced_amount).to.not.be.ok;
        expect(credit.paid_amount).to.not.be.ok;
        expect(credit.promo_amount).to.be.ok;
        expect(credit.payment_processor).to.equal(CONSTANTS.PAYMENT_PROCESSORS.STRIPE);
        done();
      })
    });

    it('should not create credit if promo_amount && paid_amount', function() {
      Credit.create({
        user: 'user1@example.com',
        invoiced_amount: 1000,
        paid_amount: 1000,
        promo_amount: 1000,
        promo_code: 'STORJPROMO30',
        type: 'manual',
        payment_processor: CONSTANTS.PAYMENT_PROCESSORS.STRIPE,
        created: '07/30/2016'
      }, {}, function(err, credit) {
        expect(err).to.be.instanceOf(Error);
        expect(credit).to.not.be.ok;
        expect(err.message).to.equal('Credit validation failed');
      })
    });

    it('should not create credit if no amount is given', function() {
      Credit.create({
        user: 'user1@example.com',
        type: CONSTANTS.CREDIT_TYPES.MANUAL,
        payment_processor: CONSTANTS.PAYMENT_PROCESSORS.STRIPE
      }, {}, function(err, credit) {
        expect(err).to.be.instanceOf(Error);
        expect(credit).to.not.be.ok;
      })
    });

    it('should not create a credit without a user', function() {
      Credit.create({
        paid_amount: 1000,
        invoiced_amount: 1000,
        type: CONSTANTS.CREDIT_TYPES.AUTO,
        payment_processor: CONSTANTS.PAYMENT_PROCESSORS.STRIPE,
        paid: false
      }, function(err, credit) {
        expect(err).to.be.instanceOf(Error);
        expect(credit).to.not.be.ok;
        expect(err.message).to.equal('Credit validation failed');
      })
    });

    it('should correctly store data object', function() {
      Credit.create({
        user: 'user1@example.com',
        paid_amount: 1000,
        invoiced_amount: 1000,
        type: CONSTANTS.CREDIT_TYPES.AUTO,
        payment_processor: CONSTANTS.PAYMENT_PROCESSORS.STRIPE,
        paid: false,
        data: dataObject
      }, {}, function(err, credit) {
        expect(err).to.not.be.instanceOf(Error);
        expect(credit).to.be.ok;
        expect(credit.data).to.be.ok;
      })
    });

    // TODO: Add tests for credit type properties

    // TODO: Add tests for credit date handling

  });

})
