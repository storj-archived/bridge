'use strict';

const rawbody = require('../middleware/rawbody');
const log = require('../../logger')();

/**
 * Creates a set of bound request handler
 * @function
 * @param {Storage} storage
 * @param {Network} network
 * @param {Mailer} mailer
 */
function UsersRouterFactory(config, storage, network, mailer) {

  const User = storage.models.User;

  /**
   * Registers a new user
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function createUser(req, res, next) {
    log.info('registering user account for %s', req.body.email);

    User.create(req.body.email, req.body.password, function(err, user) {
      if (err) {
        return next(err);
      }

      res.send(user.toObject());

      let host = config.server.host;
      let port = [443, 80].indexOf(config.server.port) === -1 ?
                 ':' + config.server.port :
                 '';
      let proto = config.server.ssl &&
                  config.server.ssl.cert &&
                  config.server.ssl.key ?
                  'https:' :
                  'http:';

      mailer.dispatch(user.email, 'confirm', {
        token: user.activator,
        redirect: req.body.redirect,
        url: proto + '//' + host + port
      }, function(err) {
        if (err) {
          log.error('failed to send activation email, reason: %s', err.message);
        }
      });
    });
  }

  /**
   * Confirms a user account
   * @function
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Function} next
   */
  function confirmUser(req, res, next) {
    log.info('activating user with token %s', req.params.token);

    User.findOne({
      activator: req.params.token
    }, function(err, user) {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next(new Error('Invalid activation token'));
      }

      user.activate(function(err) {
        if (err) {
          return next(err);
        }

        if (req.query.redirect) {
          res.redirect(req.query.redirect);
        } else {
          res.send(user.toObject());
        }
      });
    });
  }

  return [
    ['POST' , '/users'              , rawbody, createUser],
    ['GET'  , '/activations/:token' , confirmUser]
  ];
}

module.exports = UsersRouterFactory;
