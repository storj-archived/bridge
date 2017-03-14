'use strict';

const Router = require('./index');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all storage event related
 * information and queries 
 * @constructor
 * @extends {Router}
 */
function StorageEventRouter(options) {
  if (!(this instanceof StorageEventRouter)) {
    return new StorageEventRouter(options);
  }

  Router.apply(this, arguments);
}

inherits(StorageEventRouter, Router);
