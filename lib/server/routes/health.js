'use strict';

const Router = require('./index');
const inherits = require('util').inherits;
const limiter = require('../limiter').DEFAULTS;
const middleware = require('storj-service-middleware');

function HealthRouter(options) {
  if(!(this instanceof HealthRouter)) {
    return new HealthRouter(options);
  }

  Router.apply(this, arguments);

  this.getLimiter = middleware.rateLimiter(options.redis);
}

inherits(HealthRouter, Router);

HealthRouter.prototype.health = function(req, res) {
  if (this.storage.connection.readyState === 1) {
    return res.status(200).send('OK');
  }

  res.status(503).send('Service Unavailable');
};

HealthRouter.prototype._definitions = function() {
  return [
    ['GET', '/health', this.getLimiter(limiter(1000)), this.health]
  ];
};

module.exports = HealthRouter;
