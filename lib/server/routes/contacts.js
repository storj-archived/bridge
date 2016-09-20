'use strict';

const Router = require('./index');
const errors = require('../errors');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all contact related endpoints
 * @constructor
 * @extends {Router}
 * @param options {Object}:
 *  + config {Config}
 *  + storage {Storage}
 *  + network {storj.RenterInterface}
 *  + mailer {Mailer}
 */
function ContactsRouter(options) {
  if (!(this instanceof ContactsRouter)) {
    return new ContactsRouter(options);
  }

  Router.apply(this, arguments);
}

inherits(ContactsRouter, Router);

ContactsRouter.DEFAULTS = {
  skip: 0,
  limit: 30
};

/**
 * Returns the correct skip and limit from the supplied page number
 * @private
 */
ContactsRouter.prototype._getSkipLimitFromPage = function(page) {
  page = page || 1;

  return {
    limit: ContactsRouter.DEFAULTS.limit,
    skip: (page - 1) * ContactsRouter.DEFAULTS.limit
  };
};

/**
 * Lists the contacts according the the supplied query
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
ContactsRouter.prototype.getContactList = function(req, res, next) {
  const self = this;
  const Contact = this.storage.models.Contact;

  let opts = this._getSkipLimitFromPage(req.query.page);
  let skip = opts.skip;
  let limit = opts.limit;
  let query = {};

  self.network.getConnectedContacts(function(err, connected) {
    if (err) {
      return next(err);
    }

    connected = connected.map(function(c) {
      return c.nodeID;
    });

    switch (req.query.connected) {
      case 'true':
        query = {
          _id: { $in: connected }
        };
        break;
      case 'false':
        query = {
          _id: { $nin: connected }
        };
        break;
      default:
        query = {};
    }

    Contact.find(query).skip(skip).limit(limit).exec(function(err, contacts) {
      if (err) {
        return next(new errors.InternalError(err.message));
      }

      res.status(200).send(contacts.map(function(c) {
        return c.toObject();
      }));
    });
  });
};

/**
 * Returns the contact information for the given nodeID
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
ContactsRouter.prototype.getContactByNodeID = function(req, res, next) {
  const Contact = this.storage.models.Contact;

  Contact.findOne({ _id: req.params.nodeID }, function(err, contact) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    if (!contact) {
      return next(new errors.NotFoundError('Contact not found'));
    }

    res.status(200).send(contact.toObject());
  });
};

/**
 * Export definitions
 * @private
 */
ContactsRouter.prototype._definitions = function() {
  return [
    ['GET', '/contacts', this.getContactList],
    ['GET', '/contacts/:nodeID', this.getContactByNodeID]
  ];
};

module.exports = ContactsRouter;
