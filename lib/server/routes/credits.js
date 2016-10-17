'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const errors = require('storj-service-error-types');
const authenticate = middleware.authenticate;
const constants = require('../../constants');
const STRIPE = constants.PAYMENT_PROCESSORS.STRIPE;
const CREDIT_TYPES = constants.CREDIT_TYPES;
const paymentProcessorAdapters = require('../graphql/payment-processor-adapters');
const stripe = require('../vendor/stripe');

// TODO: Refactor all stripe-related endpoints into a single endpoint
// to remain payment processor agnostic.

/**
 * Handles endpoints for all user related operations
 */
function CreditsRouter(options) {
  if (!(this instanceof CreditsRouter)) {
    return new CreditsRouter(options);
  }
  this.models = options.storage.models;

  Router.apply(this, arguments);
}

inherits(CreditsRouter, Router);

function getBillingCycle(billingDate) {
  const today = new Date();
  const daysInMonth = (new Date(today.getFullYear(), (today.getMonth()), 0)).getDate();
  const startDayOfMonth = (billingDate > daysInMonth) ? daysInMonth : billingDate;
  const startDate = Date.parse(new Date(
    today.getFullYear(),
    (today.getMonth() - 1),
    startDayOfMonth
  ));
  const endDate = (moment(startDate).add('1', 'month').unix() * 1000);
  return {
    startDate: startDate,
    endDate: endDate
  };
};

function getBalance(credits, debits) {
  const sumCredits = (total, item) => {
    return total + item.paid_amount;
  };

  const sumDebits = (total, item) => {
    return total + item.amount;
  };

  const creditSum = credits.reduce(sumCredits, 0);
  const debitSum = debits.reduce(sumDebits, 0);
  const balance = debitSum - creditSum;

  return balance;
}

function getPromoBalance(credits) {
  return credits.reduce((total, item) => {
    return total + item.promo_amount;
  }, 0);
}

function handlePaymentFailure(res) {
  console.log("payment failed: ", res.locals.event.type);
  return;
}

CreditsRouter.prototype.verify = function(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const eventId = req.body.id;
    stripe.events.retrieve(eventId, function(err, event) {
      if (err) {
        console.error('error verifying stripe event');
        next(err);
      }
      res.locals.event = event;
      next(null);
    })
  } else {
    res.locals.event = req.body;
    // NB: for manual testing only, need to remove
    res.locals.event.data.object.customer = 'cus_97ADNC3zbcPQkR';
    next(null);
  }
}

CreditsRouter.prototype.checkType = function(type) {
  return function(req, res, next) {
    if (!type.test(res.locals.event.type)) {
      console.error("Expected event type to match: ", type);
      console.error("Received: ", res.locals.event.type);
      return res.sendStatus(400);
    }

    if(type.test(res.locals.event.type)) {
      handlePaymentFailure(res);
      return res.sendStatus(203);
    }

    return next(null);
  }
};

CreditsRouter.prototype.createCredit = function(req, res) {
  const stripeAdapter = paymentProcessorAdapters[STRIPE];
  const invoice = res.locals.event.data.object;
  const customerId = invoice.customer;

  if (invoice.object === 'invoice' && invoice.attempted === 'false') {
    console.log("invoice.object should be invoice: ", invoice.object)
    console.log("invoice.attempted should be false: ", invoice.attempted);
    return res.sendStatus(400);
  }

  this.models.User.findOne({
      'paymentProcessors.rawData.customer.id': customerId
    })
    .then((user) => {
      const stripeProcessor = user.paymentProcessors
        .find((processor) => (processor.name === STRIPE));
      const billingCycle = getBillingCycle(stripeProcessor.billingDate);
      const params = {
        user: user._id,
        created: {
          $gte: moment(parseInt(billingCycle.startDate, 0)),
          $lte: moment(parseInt(billingCycle.endDate, 0))
        }
      };

      return [
        this.models.Debit.find(params),
        this.models.Credit.find(params),
        this.models.Credit.find({
          user: user._id
        }),
        user,
        billingCycle
      ];
    })
    .then((promises) => (Promise.all(promises)))
    .then((results) => {
      const debits = results[0];
      const credits = results[1];
      const allCredits = results[2];
      const user = results[3];
      const billingCycle = results[4];

      const balance = getBalance(credits, debits);
      const promoBalance = getPromoBalance(allCredits);

      const invoiceAmount = (balance - promoBalance < 0) ?
        0 : balance - promoBalance;

      const promoUsed = (promoBalance - balance > 0) ?
        balance : promoBalance;

      const totalAmount = (invoiceAmount < 0) ?
        0 : invoiceAmount

      const newCredit = new this.models.Credit({
        invoiced_amount: invoiceAmount,
        paid_amount: 0,
        paid: false,
        promo_amount: promoUsed,
        user: user._id,
        payment_processor: STRIPE,
        type: CREDIT_TYPES.AUTO,
        data: {
          invoice: invoice
        }
      });

      newCredit.save((err, credit) => {
        if (err) {
          throw new Error(err);
        }
      })
    })
    .catch((err) => {
      console.error(err);
      throw new Error(err);
    })

  res.sendStatus(201);
}

CreditsRouter.prototype.confirmCredit = function(req, res) {
  if(!invoice.paid){
    return res.status(202).json({'message':'Invoice has not been paid.'})
  }

  this.models.Credit.findOne({
    'data.invoice.id': invoice.id
  })
  .then((credit) => {
    if(credit.invoiced_amount !== invoice.subtotal){
      console.error("Invoiced amount not equal to invoice subtotal.");
      console.error("Expected: ", credit.invoiced_amount);
      console.error("Received: ", invoice.subtotal);
      return res.sendStatus(202);
    }

    if(!result){
      console.error("Could not find credit with invoice id: ", invoice.id);
      return res.sendStatus(202);
    }

    credit.paid_amount = invoice.subtotal;
    credit.paid = true;
    credit.data = {
      invoice: invoice
    };

    return credit.save();
  })
  .then((result) => {
    return res.sendStatus(204)
  })
  .catch((err) => {
    console.error("Error updating credit: ", err);
    return res.sendStatus(500);
  })

};
/**
 * Export definitions
 * @private
 */
CreditsRouter.prototype._definitions = function() {
  return [
    ['POST', '/credits',
      rawbody,
      this.verify,
      this.checkType(/^invoice.created$/),
      this.createCredit
    ],
    ['POST', '/credits/confirm',
      rawbody,
      this.verify,
      this.checkType(/^invoice.payment_(succeeded|failed)$/),
      this.confirmCredit
    ]
  ];
};

module.exports = CreditsRouter;
