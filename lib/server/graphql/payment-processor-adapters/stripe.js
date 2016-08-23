'use strict';

// TODO: pull secret key from env var
// NB: this is not a real secret key so u dudes who think ur clever can suck it!
const stripe = require('stripe')('sk_test_W6L09JRZ1YR4Ua0KuDCDTST3');
const constants = require('../../../constants');
const STRIPE = constants.PAYMENT_PROCESSORS.STRIPE;
const STRIPE_PLAN_ID = constants.STRIPE_PLAN_ID;

/**
 * checkCustomerStatus - check if current user has a payment processor
 * with `_id` of `STRIPE`
 * @param options {Object}
 *   + isCustomer {boolean}
 *   + user {User}
 *   + stripeProcessor {User#PaymentProcessor}: the `PaymentProcessor`
 *     element of `User` which has `_id` of `STRIPE`
 * @return {Promise}
 */
function checkCustomerStatus(options) {
  const user = options.user;
  const stripeProcessor = user.paymentProcessors.filter(
      (processor) => (processor._id === STRIPE)
  )[0];

  // TODO: make this more robust: maybe parse customer id and
  //   verify it's still valid with stripe?
  const isCustomer = (typeof(stripeProcessor) !== 'undefined');

  return ({
    isCustomer: isCustomer,
    user: user,
    stripeProcessor: stripeProcessor
  });
}

/**
 * isSubscribed - returns true if the user has a subscription to
 * the stripe plan with id of `STRIPE_PLAN_ID`
 * @param stripeProcessor {User#PaymentProcessor}: the `PaymentProcessor`
 * element of `User` which has `_id` of `STRIPE`
 * @return {Promise}: resolves true/false, reject with error
 */
function checkSubscription(stripeProcessor) {
  const subscriptions = JSON.parse(stripeProcessor.data[0]).subscriptions;

  if (subscriptions.length > 1) {
    // TODO: add actual error handling...
    throw new Error('customer has more than one stripe subscription!');
  }

  if (subscriptions.length < 1) {
    console.warn('customer has no subscriptions!');
    return false;
  }

  if (subscriptions.data[0].plan.id === STRIPE_PLAN_ID) {
    return true;
  }

  // TODO: add actual error handling...
  throw new Error('customer is subscribed to unknown plan!');
}

// function subscribeCustomer() {
//
// }

/**
 * createCustomer - use stripe api to create customer
 * @param token {String}: credit card token returned from stripe api
 * (see https://stripe.com/docs/subscriptions/tutorial)
 * @param user {User}: current user for the request
 * @return {Promise}
 */
function createCustomer(token, user) {
  stripe.customers.create({
    source: token,
    plan: STRIPE_PLAN_ID,
    email: user.email
  }, (err, customer) => {
    if (err) {
      throw new Error(err);
    }

    console.log('pre push');
    user.paymentProcessors.push({_id: STRIPE, data: [JSON.stringify(customer)]});
    console.log('post push');
    return user.save()
        .then(() => {
          return {
            status: 'success',
            message: 'customer added to stripe'
          };
        })
        .catch((err) => {
          throw err;
        })
        ;
  });
}

const stripeAdapter = {
  /**
   * add - adds the stripe (`STRIPE`) payment processor to the user (`User`)
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}: resolves/rejects with an object with `status`
   * and `message` properties
   */
  add: function(options) {
    return new Promise((resolve, reject) => {
      const status = checkCustomerStatus(options);
      if (status.isCustomer) {
        if (checkSubscription((status.stripeProcessor))) {
          return resolve({
            status: 'success',
            message: 'customer already exists and is subscribed'
          });
        }

        // subscribeCustomer
        return reject(new Error('subscribeCustomer not yet implemented!'));
      }

      return createCustomer(options.data, options.user);
    });
  },
  /**
   * addCard - add a credit card to the users stripe customer
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}: resolves/rejects with an object with `status`
   * and `message` properties
   */
  addCard: function(options) {
    return this.add(options).then(() => {
      throw new Error('stripe charge method not yet implemented');
    });
  },
  /**
   * charge - add an inventory item to the subscription's current
   * billing cycle
   * (see https://stripe.com/docs/subscriptions/guide#adding-invoice-items)
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}
   */
  charge: function(options) {
    return this.add(options).then(()=> {
      throw new Error('stripe charge method not yet implemented');
    });
  }
};

module.exports = stripeAdapter;
