'use strict';

const graphql = require('graphql');
const models = require('../index').models;
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorEnum = require('../types/payment-processor-enum');
const paymentProcessorAdapters = require('../payment-processor-adapters');

const addPaymentProcessor = {
  type: paymentProcessorType,
  args: {
    name: {
      type: paymentProcessorEnum
    },
    data: {
      type: graphql.GraphQLString
    }
  },
  resolve: function(_, args) {
    const publicKeyHeader = graphqlService.lastRequest.header('x-pubkey');
    if (!publicKeyHeader) {
      return Promise.reject({status: 'error', message: 'Request not authenticated via ECDSA.'});
    }

    return models.PublicKey.findOne({_id: publicKeyHeader})
        .then((publicKey)=> {
          return models.User.findOne({_id: publicKey.user})
              .then((user) => {

                return paymentProcessorAdapters[args.name].add({
                  data: JSON.parse(args.data),
                  user: user
                });
              });
        }).catch((err) => {
          throw err;
        });
  }
};

module.exports = addPaymentProcessor;
