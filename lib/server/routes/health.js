'use strict';

const Router = require('./index');
const inherits = require('util').inherits;

function HealthRouter(options) {
  if(!(this instanceof HealthRouter)) {
    return new HealthRouter(options);
  }

  Router.apply(this, arguments);
}

inherits(HealthRouter, Router);

HealthRouter.prototype.health = function(req, res) {
  if (!this.storage) {
    res.status(503).send('Service Unavailable');
  }

  res.status(200).send('OK');
};

HealthRouter.prototype._definitions = function() {
  return [
    ['GET', '/health', this.health]
  ];
};

module.exports = HealthRouter;
