'use strict';

const Router = require('./index');
const rawbody = require('../middleware/rawbody');
const log = require('../../logger');
const errors = require('../errors');
const merge = require('merge');
const inherits = require('util').inherits;
const authenticate = require('../middleware').authenticate;

/**
* Handles endpoints for all user related operations
*/
function CreditsRouter(config, storage, network, mailer) {
  if(!(this instanceof CreditsRouter)) {
    return new CreditsRouter(config, network, storage, mailer);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
}

inherits(CreditsRouter, Router);

CreditsRouter.prototype.handleStripeCallback(req, res, next) {
  console.log('get context for user email ');
  console.log('create credit or debit and add to user');
}


/**
 * Export definitions
 * @private
 */
 CreditsRouter.prototype._definitions = function() {
  return [
  ];
};

module.exports = FramesRouter;
