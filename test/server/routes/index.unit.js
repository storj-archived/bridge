'use strict';

const Router = require('../../../lib/server/routes');
const expect = require('chai').expect;

describe('Router', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(Router({})).to.be.instanceOf(Router);
    });

  });

});
