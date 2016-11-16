'use strict';

const expect = require('chai').expect;
const utils = require('../lib/utils');

describe('module:utils', function() {

  describe('#createArrayFormatter', function() {

    it('should emit [] if nothing written', function(done) {
      var formatter = utils.createArrayFormatter((data) => data);
      var result = '';
      formatter.on('data', function(data) {
        result += data;
      }).on('end', function() {
        expect(result).to.equal('[]');
        done();
      }).end();
    });

  });

});
