'use strict';

const graphql = require('graphql');
const PAYMENT_PROCESSORS = require('../../../constants').PAYMENT_PROCESSORS;

const paymentProcessorEnum = new graphql.GraphQLEnumType({
  name: 'PaymentProcessorEnum',
  values: Object.keys(PAYMENT_PROCESSORS).reduce((values, processorKey) => {
    values[processorKey] = {value: PAYMENT_PROCESSORS[processorKey]};
    return values;
  }, {})
});

module.exports = paymentProcessorEnum;
