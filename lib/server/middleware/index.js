/**
 * @module metadisk/server/middleware
 */

'use strict';

module.exports = {
  rawbody: require('./rawbody'),
  authenticate: require('./authenticate'),
  errorhandler: require('./error-handler')
};
