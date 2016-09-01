const stripe = require('stripe');

if(process.env.NODE_ENV !== 'production'){
  // NB: Stripe key for development and testing.
  return module.exports = stripe('sk_test_W6L09JRZ1YR4Ua0KuDCDTST3');
}

return module.exports = stripe(process.env.STRIPE_KEY);
