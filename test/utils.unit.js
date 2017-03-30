'use strict';

const expect = require('chai').expect;
const utils = require('../lib/utils');

describe('module:utils', function() {

  describe('parseTimestamp', function() {
    it('timestamp as string', function() {
      const ts = utils.parseTimestamp('1489617787371');
      expect(ts).to.equal(1489617787371);
    });

    it('timestamp as string (double)', function() {
      const ts = utils.parseTimestamp('1489617787371.89');
      expect(ts).to.equal(1489617787371);
    });

    it('timestamp as number', function() {
      const ts = utils.parseTimestamp(1489617787371);
      expect(ts).to.equal(1489617787371);
    });

    it('ISO string', function() {
      const ts = utils.parseTimestamp('2017-03-15T22:44:25.736Z');
      expect(ts).to.equal(1489617865736);
    });

    it('undefined', function() {
      const ts = utils.parseTimestamp();
      expect(ts).to.equal(0);
    });

    it('null', function() {
      const ts = utils.parseTimestamp(null);
      expect(ts).to.equal(0);
    });

    it('hex string', function() {
      const ts = utils.parseTimestamp('abcdef');
      expect(ts).to.equal(0);
    });

    it('garbage string', function() {
      const ts = utils.parseTimestamp('garbage');
      expect(ts).to.equal(0);
    });
  });

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
