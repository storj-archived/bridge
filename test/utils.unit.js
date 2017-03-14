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

  describe('#isValidObjectId', function() {
    it('false for non 12 byte hex', function() {
      expect(utils.isValidObjectId('936389d173e710d3fcfb66')).to.equal(false);
    });

    it('false for 12 byte non-hex', function() {
      expect(utils.isValidObjectId('rxxPuB1N3vTd2kiJ')).to.equal(false);
    });

    it('false for 24 character non-hex', function() {
      expect(utils.isValidObjectId('1z\z78z1}b1fz59d+3z98a08')).to.equal(false);
    });

    it('false for a number', function() {
      expect(utils.isValidObjectId(123442039474034443320)).to.equal(false);
    });

    it('false for an object', function() {
      expect(utils.isValidObjectId({})).to.equal(false);
    });

    it('true for 12 byte hex (lowercase)', function() {
      expect(utils.isValidObjectId('1ec962a040f104d74902f39f')).to.equal(true);
    });

    it('true for 12 byte hex (uppercase)', function() {
      expect(utils.isValidObjectId('1EC962A040F104D74902F39F')).to.equal(true);
    });
  });

});
