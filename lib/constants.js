/**
 * @module storj-bridge/constants
 */

'use strict';

module.exports = {
  /** @constant {Number} DEFAULT_FILE_TTL - File renewal interval */
  DEFAULT_FILE_TTL: '90d',
  LOG_LEVEL_NONE: 0,
  LOG_LEVEL_ERROR: 1,
  LOG_LEVEL_WARN: 2,
  LOG_LEVEL_INFO: 3,
  LOG_LEVEL_DEBUG: 4,
  /** @constant {Number} M_REPLICATE - Auto-mirror degree */
  M_REPLICATE: 5,

  /** @constant {Number} DEFAULT_MAX_ENTRIES - Used for listing entries.
      Should give a response size that should roughly equal 300kb.
  */
  DEFAULT_MAX_ENTRIES: 2000,

  /** @constant {Number} DEFAULT_MAX_BUCKETS - Used listing buckets.
      Should give a response size that should roughly equal 300kb.
  */
  DEFAULT_MAX_BUCKETS: 5000,

  /** @constant {Number} MAX_BUCKETENTRYNAME - The maximum length for a
      bucket entry. Set to the "maximum total path length" for Windows (32,767),
      to accommodate using full paths as filenames.
  */
  MAX_BUCKETENTRYNAME: 32767,

  /** @constant {Number} MAX_BUCKETNAME - The maximum length for a
      bucketname. Set to maximum length of a file/directory name across various
      filesystems and operating systems (max of 255 and 260)
  */
  MAX_BUCKETNAME: 260,

  /** @constant {Number} MAX_BLACKLIST - The maximum number of nodeIDs that
      can be blacklisted at once.
  */
  MAX_BLACKLIST: 300
};
