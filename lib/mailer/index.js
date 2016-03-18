'use strict';

const path = require('path');
const fs = require('fs');
const async = require('async');
const assert = require('assert');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');

/**
 * Interface for dispatching email
 * @constructor
 * @param {Object} options
 */
function Mailer(options) {
  if (!(this instanceof Mailer)) {
    return new Mailer(options);
  }

  options = options || {};

  assert.ok(options.host, 'No SMTP host supplied');
  assert.ok(options.port, 'No SMTP port supplied');

  this._options = options;
  this._transporter = nodemailer.createTransport(options);
}

/**
 * Sends the email template to the specified address
 * #dispatch
 * @param {String} email
 * @param {String} template
 * @param {Object} context
 * @param {Function} callback
 */
Mailer.prototype.dispatch = function(email, template, context, callback) {
  var self = this;
  var done = callback || function() {};

  self.getTemplate(template, function(err, template) {
    if (err) {
      return done(err);
    }

    let compiled = template(context);
    let mailparams = {
      to: email,
      from: self._options.from,
      subject: compiled.subject,
      html: compiled.markup,
      text: compiled.plaintext
    };

    self._transporter.sendMail(mailparams, done);
  });
};

/**
 * Loads and compiles the mail template
 * #getTemplate
 * @param {String} name
 * @param {Function} callback
 */
Mailer.prototype.getTemplate = function(name, callback) {
  assert.ok(name, 'No template name was supplied');

  let stack = [
    this._getSubject.bind(this, name),
    this._getMarkup.bind(this, name),
    this._getPlaintext.bind(this, name)
  ];

  async.parallel(stack, function(err, results) {
    if (err) {
      return callback(err);
    }

    callback(null, function render(data) {
      data = data || {};

      return {
        subject: results[0](data),
        markup: results[1](data),
        plaintext: results[2](data)
      };
    });
  });
};

/**
 * Helper for loading email template subject
 * #_getSubject
 * @param {String} name
 * @param {Function} callback
 */
Mailer.prototype._getSubject = function(name, callback) {
  this.__getTemplateResource([name, 'subject'].join('.'), callback);
};

/**
 * Helper for loading email template markup
 * #_getMarkup
 * @param {String} name
 * @param {Function} callback
 */
Mailer.prototype._getMarkup = function(name, callback) {
  this.__getTemplateResource([name, 'html'].join('.'), callback);
};

/**
 * Helper for loading email template plaintext
 * #_getPlaintext
 * @param {String} name
 * @param {Function} callback
 */
Mailer.prototype._getPlaintext = function(name, callback) {
  this.__getTemplateResource([name, 'txt'].join('.'), callback);
};

/**
 * Helper for loading email template resource
 * #__getTemplateResource
 * @param {String} filename
 * @param {Function} callback
 */
Mailer.prototype.__getTemplateResource = function(filename, callback) {
  fs.exists(path.join(__dirname, 'templates', filename), function(exists) {
    if (!exists) {
      return callback(new Error('Resource "' + filename + '" does not exist'));
    }

    fs.readFile(
      path.join(__dirname, 'templates', filename),
      function(err, contents) {
        if (err) {
          return callback(err);
        }

        callback(null, handlebars.compile(contents.toString()));
      }
    );
  });
};

module.exports = Mailer;
