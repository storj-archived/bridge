'use strict';

const expect = require('chai').expect;
const kad = require('storj/node_modules/kad');

const Logger = require('..').Logger;

describe('Logger', function() {

  describe('@constructor', function() {

    it('should create instance without the new keyword', function() {
      expect(Logger()).to.be.instanceOf(Logger);
    });

    it('should inherit from kad.Logger', function() {
      expect(new Logger()).to.be.instanceOf(kad.Logger);
    });

  });

});
