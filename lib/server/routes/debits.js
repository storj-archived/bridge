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

/**
 * Handles endpoints for all user related operations
 */
function DebitsRouter(options) {
  if (!(this instanceof DebitsRouter)) {
    return new DebitsRouter(options);
  }
  this.models = options.storage.models;

  Router.apply(this, arguments);

  // this._verify = authenticate(this.storage);
}

inherits(DebitsRouter, Router);

DebitsRouter.prototype.verify = function(req, res, next) {
  next(null);
};

DebitsRouter.prototype.createDebit = function(req, res) {
  // console.log('body: %j', req.body);
  const user = req.body.user;
  const type = req.body.type;
  const amount = req.body.amount;

  if (!user || !type || !amount) {
    res.sendStatus(400);
  }

  const debit = new this.models.Debit({
    amount: amount,
    type: type,
    user: user
  });

  const promises = [
    debit.save(),
    this.models.User.findOne({
      _id: user
    })
  ];

  Promise.all(promises)
    .then((results) => {
      const debit = results[0];
      const user = results[1];

      const customerId = user.paymentProcessors
        .find((processor) => (processor.name === STRIPE))
        .data.customer.id;

      stripe.invoiceItems.create({
        customer: customerId,
        amount: debit.amount,
        currency: 'usd',
        description: [
          'Storj.io Usage Charge - ',
          debit.type
        ].join('')
      }, (err, invoiceItem) => {
        if (err) {
          console.error(err);
          // TODO Decide whether to send actual error or customer error message
          return res.status(202).json({debit: debit, error: err})
        }

        console.log('Invoice item created: ', invoiceItem);
        return res.status(201).json({ debit: debit, invoice: invoiceItem }).end();
      });
    })
    .catch((err) => {
      console.error(err);
      // TODO Decide whether to send actual error or customer error message
      return res.status(400).json({ error: err }).end();
    })
};

/**
 * Export definitions
 * @private
 */
DebitsRouter.prototype._definitions = function() {
  return [
    ['POST', '/debits', rawbody, this.verify, this.createDebit]
  ];
};

module.exports = DebitsRouter;
