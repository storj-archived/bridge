'use strict';

const Router = require('./index');
const rawbody = require('../middleware/rawbody');
const log = require('../../logger');
const errors = require('../errors');
const merge = require('merge');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all user related operations
 * @constructor
 * @extends {Router}
 * @param {Config} config
 * @param {Storage} storage
 * @param {Network} network
 * @param {Mailer} mailer
 */
function UsersRouter(config, storage, network, mailer) {
  if (!(this instanceof UsersRouter)) {
    return new UsersRouter(config, network, storage, mailer);
  }

  Router.apply(this, arguments);
}

inherits(UsersRouter, Router);

/**
 * Registers a new user
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.createUser = function(req, res, next) {
  const self = this;
  const User = this.storage.models.User;
  const PublicKey = this.storage.models.PublicKey;

  log.info('registering user account for %s', req.body.email);

  User.create(req.body.email, req.body.password, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    function dispatchActivationEmail() {
      let host = self.config.server.host;
      let port = [443, 80].indexOf(self.config.server.port) === -1 ?
                 ':' + self.config.server.port :
                 '';
      let proto = self.config.server.ssl &&
                  self.config.server.ssl.cert &&
                  self.config.server.ssl.key ?
                  'https:' :
                  'http:';

      self.mailer.dispatch(user.email, 'confirm', {
        token: user.activator,
        redirect: req.body.redirect,
        url: proto + '//' + host + port
      }, function(err) {
        if (err) {
          log.error('failed to send activation email, reason: %s', err.message);
        }
      });
    }

    if (!req.body.pubkey) {
      dispatchActivationEmail();
      return res.status(200).send(user.toObject());
    }

    PublicKey.create(user, req.body.pubkey, function(err, pubkey) {
      if (err) {
        user.remove();
        return next(new errors.BadRequestError(err.message));
      }

      dispatchActivationEmail();
      res.status(200).send(merge(user.toObject(), {
        pubkey: pubkey.key
      }));
    });
  });
};

/**
 * Confirms a user account
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.confirmUser = function(req, res, next) {
  const User = this.storage.models.User;

  log.info('activating user with token %s', req.params.token);

  User.findOne({
    activator: req.params.token
  }, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!user) {
      return next(new errors.BadRequestError('Invalid activation token'));
    }

    user.activate(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (req.query.redirect) {
        res.redirect(req.query.redirect);
      } else {
        res.send(user.toObject());
      }
    });
  });
};

/**
 * Export definitions
 * @private
 */
UsersRouter.prototype._definitions = function() {
  return [
    ['POST', '/users', rawbody, this.createUser ],
    ['GET', '/activations/:token', this.confirmUser]
  ];
};

module.exports = UsersRouter;
