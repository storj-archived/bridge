'use strict';

const Router = require('./index');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;

/**
 * Handles endpoints for all contact related endpoints
 * @constructor
 * @extends {Router}
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
  const Contact = this.storage.models.Contact;

  let allowedQueryParams = ['address', 'port', 'protocol', 'userAgent'];
  let opts = this._getSkipLimitFromPage(req.query.page);
  let skip = opts.skip;
  let limit = opts.limit;
  let query = {};

  for (let param in req.query) {
    if (allowedQueryParams.indexOf(param) !== -1) {
      query[param] = req.query[param];
    }
  }

  let cursor = Contact.find(query).skip(skip).limit(limit).sort({
    lastSeen: -1
  });

  cursor.exec(function(err, contacts) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }

    res.status(200).send(contacts.sort(function(c1, c2) {
      return c2.lastSeen - c1.lastSeen;
    }).map(function(c) {
      return c.toObject();
    }));
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
