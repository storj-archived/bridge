'use strict';

const Router = require('./index');
const rawbody = require('../middleware/rawbody');
const log = require('../../logger');
const errors = require('../errors');
const merge = require('merge');
const inherits = require('util').inherits;
const authenticate = require('../middleware').authenticate;
const moment = require('moment');
const STRIPE = require('../../constants').PAYMENT_PROCESSORS.STRIPE;
const paymentProcessorAdapters = require('../graphql/payment-processor-adapters');


/**
* Handles endpoints for all user related operations
*/
function DebitsRouter(options) {
  if(!(this instanceof DebitsRouter)) {
    return new DebitsRouter(options);
  }
  this.models = options.storage.models;

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
}

inherits(DebitsRouter, Router);

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

DebitsRouter.prototype.verify = function(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const eventId = req.body.id;
    stripe.events.retrieve(eventId, function(err, event) {
      if(err){
        console.error('error verifying stripe event');
        next(err);
      }
      res.locals.event = event;
      next(null);
    })
  } else {
    res.locals.event = req.body;
    next(null);
  }
}

DebitsRouter.prototype.debitSync = function(req, res) {
  const stripeAdapter = paymentProcessorAdapters[STRIPE];
  const invoice = res.locals.event.data.object;
  if(invoice.object !== 'invoice'){
    return res.sendStatus(400);
  }

  this.models.User.findOne({
    'paymentProcessors.rawData.customer.id': invoice.customer
  })
  .then((user) => {
    console.log("user: ", user);
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
    this.models.Debit.find(params)
      .then((debits) => {
        console.log("Debits returned: ", debits);
      })
  })
  .catch((err) => {
    console.error("Error finding debits or user", err);
  })

  res.sendStatus(200);

}


/**
 * Export definitions
 * @private
 */
 DebitsRouter.prototype._definitions = function() {
  return [
    ['POST', '/debits/sync', rawbody, this.verify, this.debitSync]
  ];
};

module.exports = DebitsRouter;
