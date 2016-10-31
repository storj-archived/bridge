'use strict';

const expect = require('chai').expect;
const FramesRouter = require('../../../lib/server/routes/frames');

describe('FramesRouter', function() {

  describe('#createFrame', function() {

    it.skip('should return internal error if create fails');

    it.skip('should return the created frame');

  });

  describe('#_getContractForShard', function() {

    it.skip('should callback with error if no offer received');

    it.skip('should callback with error if contract cannot save');

    it.skip('should callback with farmer and contract');

  });

  describe('#addShardToFrame', function() {

    it.skip('should return internal error if frame query fails');

    it.skip('should return not found if frame no found');

    it.skip('should return internal error if pointer cannot create');

    it.skip('should return bad request if audit stream throws');

    it.skip('should return internal error if no offer received');

    it.skip('should return internal error if cannot get consign token');

    it.skip('should return internal error if frame cannon reload');

    it.skip('should return internal error if frame cannot update');

    it.skip('should return data channel pointer');

  });

  describe('#destroyFrameById', function() {

    it.skip('should return internal error if bucket entry query fails');

    it.skip('should return bad request if frame is ref\'d by entry');

    it.skip('should return internal error if frame query fails');

    it.skip('should return not found if no frame found');

    it.skip('should return internal error if remove fails');

    it.skip('should return a 204 if delete succeeds');

  });

  describe('#getFrames', function() {

    it.skip('should return internal error if query fails');

    it.skip('should return frame list');

  });

  describe('#getFrameById', function() {

    it.skip('should return internal error if query fails');

    it.skip('should return not found if no frame found');

    it.skip('should return the frame');

  });

});
