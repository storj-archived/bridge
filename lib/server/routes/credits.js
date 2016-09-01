'use strict';

const Router = require('./index');
const rawbody = require('../middleware/rawbody');
const log = require('../../logger');
const errors = require('../errors');
const merge = require('merge');
const inherits = require('util').inherits;
const authenticate = require('../middleware').authenticate;
const stripe = require('../vendor/stripe');

/**
* Handles endpoints for all user related operations
*/
function CreditsRouter(options) {
  if(!(this instanceof CreditsRouter)) {
    return new CreditsRouter(options);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
}

inherits(CreditsRouter, Router);

/**
 * Export definitions
 * @private
 */
 CreditsRouter.prototype._definitions = function() {
  return [
  ];
};

module.exports = CreditsRouter;
