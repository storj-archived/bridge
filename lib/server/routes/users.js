'use strict';

const Router = require('./index');
const rawbody = require('../middleware/rawbody');
const log = require('../../logger');
const errors = require('../errors');
const merge = require('merge');
const inherits = require('util').inherits;
const authenticate = require('../middleware').authenticate;
const crypto = require('crypto');

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

  this._verify = authenticate(this.storage);
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
      return next(err);
    }

    function dispatchActivationEmail() {
      let profile = self.config.server.public || self.config.server;
      let host = profile.host;
      let port = [443, 80].indexOf(profile.port) === -1 ?
                 ':' + profile.port :
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
      return res.status(201).send(user.toObject());
    }

    PublicKey.create(user, req.body.pubkey, function(err, pubkey) {
      if (err) {
        user.remove();
        return next(new errors.BadRequestError(err.message));
      }

      dispatchActivationEmail();
      res.status(201).send(merge(user.toObject(), {
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
UsersRouter.prototype.confirmActivateUser = function(req, res, next) {
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
 * Deactivates a user account
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.destroyUser = function(req, res, next) {
  const self = this;
  const User = this.storage.models.User;

  log.info('creating user deactivation token');

  User.findOne({ _id: req.params.id }, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!user) {
      return next(new errors.NotFoundError());
    }

    if (req.user._id !== user._id) {
      return next(new errors.NotAuthorizedError());
    }

    user.deactivator = crypto.randomBytes(256).toString('hex');

    let profile = self.config.server.public || self.config.server;
    let host = profile.host;
    let port = [443, 80].indexOf(profile.port) === -1 ?
               ':' + profile.port :
               '';
    let proto = self.config.server.ssl &&
                self.config.server.ssl.cert &&
                self.config.server.ssl.key ?
                'https:' :
                'http:';

    self.mailer.dispatch(user.email, 'delete', {
      token: user.deactivator,
      redirect: req.body.redirect,
      url: proto + '//' + host + port
    }, function(err) {
      if (err) {
        log.error('failed to send deactivation email, reason: %s', err.message);
      }

      user.save(function(err) {
        if (err) {
          return next(new errors.InternalError(err.message));
        }

        res.status(200).send(user.toObject());
      });
    });
  });
};

/**
 * Confirms the deletion of a user account
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.confirmDestroyUser = function(req, res, next) {
  const User = this.storage.models.User;

  log.info('deactivating user account with token %s', req.params.token);

  User.findOne({ deactivator: req.params.token }, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!user) {
      return next(new errors.NotFoundError());
    }

    user.deactivate(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (req.query.redirect) {
        res.redirect(req.query.redirect);
      } else {
        res.status(200).send(user.toObject());
      }
    });
  });
};

/**
 * Creates a password reset token
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.createPasswordResetToken = function(req, res, next) {
  const self = this;
  const User = this.storage.models.User;

  if (Buffer(req.body.password, 'hex').length * 8 !== 256) {
    return next(new Error('Password must be hex encoded SHA-256 hash'));
  }

  User.findOne({ _id: req.params.id }, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!user) {
      return next(new errors.NotFoundError());
    }

    log.info('creating password reset token for %s', user._id);

    user.resetter = crypto.randomBytes(256).toString('hex');
    user.pendingHashPass = crypto.createHash('sha256').update(req.body.password).digest('hex');

    user.save(function(err) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      let profile = self.config.server.public || self.config.server;
      let host = profile.host;
      let port = [443, 80].indexOf(profile.port) === -1 ?
                 ':' + profile.port :
                 '';
      let proto = self.config.server.ssl &&
                  self.config.server.ssl.cert &&
                  self.config.server.ssl.key ?
                  'https:' :
                  'http:';

      self.mailer.dispatch(user.email, 'reset', {
        token: user.resetter,
        redirect: req.body.redirect,
        url: proto + '//' + host + port
      }, function(err) {
        if (err) {
          log.error('failed to send reset email, reason: %s', err.message);
        }

        res.status(200).send(user.toObject());
      });
    });
  });
};

/**
 * Confirms and applies the password reset
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.confirmPasswordReset = function(req, res, next) {
  const User = this.storage.models.User;

  /*
   * Mitigate timing attack
   *  attempt to make non-lookup-responses take similar
   *  amounts of time as lookup-responses
   */
  User.count({}, function(err, count) {
    const rand = Math.floor(Math.random() * count);
    const nextPlusTime = (value) => {
      User.findOne(function() { // do nothing with this record
        next(value);
      }).skip(rand);
    };

    // Ensure resseter is valid; mitigate things like `PATCH /resets/null`, etc.
    //-- TODO: test - ensure passwords for users without resetters can't be reset
    if (Buffer(req.params.token, 'hex').length !== 256) {
      return nextPlusTime(new Error('Resetter must be hex encoded 256 byte string'));
    }

    User.findOne({resetter: req.params.token}, function(err, user) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!user) {
        return next(new errors.NotFoundError());
      }

      user.hashpass = user.pendingHashPass;
      user.pendingHashPass = null;
      user.resetter = null;

      user.save(function(err) {
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
  });
};

/**
 * Export definitions
 * @private
 */
UsersRouter.prototype._definitions = function() {
  return [
    ['POST', '/users', rawbody, this.createUser],
    ['GET', '/activations/:token', this.confirmActivateUser],
    ['DELETE', '/users/:id', this._verify, this.destroyUser],
    ['GET', '/deactivations/:token', this.confirmDestroyUser],
    ['PATCH', '/users/:id', rawbody, this.createPasswordResetToken],
    ['GET', '/resets/:token', this.confirmPasswordReset]
  ];
};

module.exports = UsersRouter;
