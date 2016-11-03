'use strict';

const assert = require('assert');
const Router = require('./index');
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const errors = require('storj-service-error-types');
const merge = require('merge');
const inherits = require('util').inherits;
const authenticate = middleware.authenticate;
const crypto = require('crypto');
const storj = require('storj-lib');

/**
 * Handles endpoints for all user related operations
 * @constructor
 * @extends {Router}
 */
function UsersRouter(options) {
  if (!(this instanceof UsersRouter)) {
    return new UsersRouter(options);
  }

  Router.apply(this, arguments);

  this._verify = authenticate(this.storage);
}

inherits(UsersRouter, Router);

/**
 * Sends a user activation email
 * @private
 */
UsersRouter.prototype._dispatchActivationEmail = function(user, redir, cb) {
  let self = this;
  let profile = self.config.server.public || self.config.server;
  let host = profile.host;
  let callback = cb || storj.utils.noop;
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
    redirect: redir,
    url: proto + '//' + host + port
  }, function(err) {
    if (err) {
      log.error('failed to send activation email, reason: %s', err.message);
      callback(err);
    } else {
      callback(null);
    }
  });
};


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

    if (!req.body.pubkey) {
      self._dispatchActivationEmail(user, req.body.redirect);
      return res.status(201).send(user.toObject());
    }

    PublicKey.create(user, req.body.pubkey, function(err, pubkey) {
      if (err) {
        user.remove();
        return next(new errors.BadRequestError(err.message));
      }

      self._dispatchActivationEmail(user, req.body.redirect);
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
 * Reactivates a user account
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
UsersRouter.prototype.reactivateUser = function(req, res, next) {
  const self = this;
  const User = this.storage.models.User;

  log.info('sending account reactivation email to %s', req.body.email);

  User.findOne({
    _id: req.body.email
  }, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!user) {
      return next(new errors.NotFoundError('User not found'));
    }

    if (user.activated) {
      return next(new errors.BadRequestError('User is already activated'));
    }

    self._dispatchActivationEmail(user, req.body.redirect);
    res.status(201).send(user.toObject());
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
      return next(new errors.NotFoundError('User not found'));
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
        return next(new errors.InternalError(err.message));
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
      return next(new errors.NotFoundError('User not found'));
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

  try {
    assert(Buffer(req.body.password, 'hex').length * 8 === 256);
  } catch (err) {
    return next(new errors.BadRequestError(
      'Password must be hex encoded SHA-256 hash'
    ));
  }

  User.findOne({ _id: req.params.id }, function(err, user) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!user) {
      return next(new errors.NotFoundError('User not found'));
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
          return next(new errors.InternalError(err.message));
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

  // NB: Mitigate timing attack
  // NB: - attempt to make non-lookup-responses take similar
  // NB: - amounts of time as lookup-responses
  User.count({}, function(err, count) {
    let rand = Math.floor(Math.random() * count);

    function nextPlusTime(value) {
      User.findOne({}).skip(rand).exec(function() { // do nothing with this record
        next(value);
      });
    }

    try {
      assert(Buffer(req.params.token, 'hex').length === 256);
    } catch (err) {
      return nextPlusTime(new Error('Resetter must be hex encoded 256 byte string'));
    }

    User.findOne({ resetter: req.params.token }, function(err, user) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      if (!user) {
        return next(new errors.NotFoundError('User not found'));
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
    ['POST', '/activations', rawbody, this.reactivateUser],
    ['GET', '/activations/:token', this.confirmActivateUser],
    ['DELETE', '/users/:id', this._verify, this.destroyUser],
    ['GET', '/deactivations/:token', this.confirmDestroyUser],
    ['PATCH', '/users/:id', rawbody, this.createPasswordResetToken],
    ['GET', '/resets/:token', this.confirmPasswordReset]
  ];
};

module.exports = UsersRouter;
