'use strict';

const Router = require('./index');
const rawbody = require('../middleware/rawbody');
const log = require('../../logger');
const errors = require('../errors');
const merge = require('merge');
const inherits = require('util').inherits;
const authenticate = require('../middleware').authenticate;
const moment = require('moment');

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
  const daysInMonth = (new Date(today.getFullYear(), (today.getMonth() - 1), 0)).getDate();
  const startDayOfMonth = (billingDate > daysInMonth) ? daysInMonth : billingDate;
  const startDate = Date.parse(new Date(
    today.getFullYear(),
    (today.getMonth() - 2),
    startDayOfMonth
  ));
  const endDate = (moment(startDate).add('1', 'month').unix() * 1000);
  return {
    startDate: startDate,
    endDate: endDate
  };
};

DebitsRouter.prototype.verify = function(req, res, next) {
  if (process.env.NODE_ENV==='production') {
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
  // console.log("createCredit body: ", req.body);
  // console.log("res.locals.event: ", res.locals.event);
  const invoice = res.locals.event.data.object;
  console.log(invoice);

  this.models.User.findOne({
    'paymentProcessors.rawData.customer.id': invoice.customer
  })
  .then((data) => {
    console.log("USER *****: ", data);
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
