'use strict';

const constants = require('../../../constants');
const BRAINTREE = constants.PAYMENT_PROCESSORS.BRAINTREE;

const braintreeAdapter = {
  add: function(){
    return new Promise((resolve, reject) => {
      return reject({
        status: 'error',
        message: 'braintree payment processor adapter not yet implemented!'
      });
    });
  }
};

module.exports = braintreeAdapter;
