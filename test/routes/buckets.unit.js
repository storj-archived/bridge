'use strict';

const expect = require('chai').expect;
const Engine = require('../../').Engine;
const Config = require('../../').Config;
const storj = require('storj-lib');

const request = require('supertest');
const async = require('async');

describe('BucketRoutes', function() {

  var config = Config('__tmptest');
  config.storage.name = '__bucketRoutesTest';
  var engine = new Engine(config);
  var app;
  var models;

  var user = 'user@domain.tld';
  var password = 'password';
  var hashedPassword = storj.utils.sha256(password);
  var bucketName = 'New Bucket';
  var fileName = 'test.txt';
  var mimetype = 'text/plain';

  var bucketId, fileId, frameId, publicBucketId;
  var publicBucketName = 'Public Bucket';
  var encryptionKey = 'abcdef';
  var publicPermissions = ['PULL', 'PUSH'];

  var initialize = function(done) {

    async.series([
      // create user
      function(callback) {
        models.User.create(user, hashedPassword, function(err, userModel){
          userModel.activate(callback);
        });
      },
      // create private bucket
      function(callback) {
        models.Bucket.create({
          _id: user
        },
        {
          pubkeys: [],
          name: bucketName
        }, function(err, bucket){
          bucketId = bucket.id.toString();
          callback();
        });
      },
      // create frame
      function(callback) {
        models.Frame.create(user, function(err, frame){
          frameId = frame.id.toString();
          callback();
        });
      },
      // create bucket entry for private bucket
      function(callback) {
        models.BucketEntry.create({
          bucket: bucketId,
          frame: frameId,
          mimetype: mimetype,
          name: fileName
        }, function(err, entry){
          fileId = entry.id.toString();
          callback();
        });
      },
      // create bucket which will be made public
      function(callback){
        models.Bucket.create({
            _id: user
          },
          {
            pubkeys: [],
            name: publicBucketName
          }, function(err, bucket){
            publicBucketId = bucket.id.toString();
            callback();
          });
      }
    ], done);

  };

  before(function(done) {
    engine.start(function(err) {
      if(err) {
        return done(err);
      }
      app = engine.server.app;
      models = engine.storage.models;
      initialize(done);
    });
  });

  after(function() {
    for(var key in models) {
      models[key].remove({}, storj.utils.noop);
    }
  });

  describe('#updateBucketById', function() {

    it('should return internal error message', function(done) {
      var badBucketId = '01234567891ab';
      request(app)
        .patch('/buckets/' + badBucketId)
        .auth(user, hashedPassword)
        .expect(500)
        .end(function(err, res) {
          expect(err).to.equal(null);
          expect(res.res.statusMessage).to.equal('Internal Server Error');
          done();
      });
    });

    it('should reject invalid update', function(done) {
      request(app)
        .patch('/buckets/' + publicBucketId)
        .send({ publicPermissions: ['Invalid'] })
        .auth(user, hashedPassword)
        .expect(500)
        .end(function(err, res) {
          expect(err).to.equal(null);
          expect(res.res.statusMessage).to.equal('Internal Server Error');
          done();
      });
    });

    it('should update the bucket permissions and encryptionKey', function(done) {
      request(app)
        .patch('/buckets/' + publicBucketId)
        .send({
          publicPermissions: publicPermissions,
          encryptionKey: encryptionKey,
        })
        .auth(user, hashedPassword)
        .expect(200)
        .end(function(err, res) {
          expect(err).to.equal(null);
          var body = res.body;
          expect(body.publicPermissions).to.include.members(publicPermissions);
          expect(body.encryptionKey).to.equal(encryptionKey);
          done();
      });
    });

  });

  describe('#createBucketToken', function() {

    it('Should reject due to invalid auth', function(done) {
      request(app)
        .post('/buckets/' + bucketId + '/tokens')
        .send({ operation: 'PULL' })
        .expect(500)
        .end(function(err, res) {
          expect(err).to.equal(null);
          expect(res.res.statusMessage).to.equal('Internal Server Error');
          done();
      });
    });

    it('Should allow access to bucket with auth', function(done) {
      request(app)
        .post('/buckets/' + bucketId + '/tokens')
        .auth(user, hashedPassword)
        .send({ operation: 'PULL' })
        .expect(201)
        .end(function(err, res) {
          expect(err).to.equal(null);
          var body = res.body;
          expect(body.encryptionKey).to.equal('');
          done();
      });
    });

    it('Should allow access to public bucket without auth', function(done) {
      request(app)
        .post('/buckets/' + publicBucketId + '/tokens')
        .send({ operation: 'PULL' })
        .expect(201)
        .end(function(err, res) {
          expect(err).to.equal(null);
          var body = res.body;
          expect(body.encryptionKey).to.equal(encryptionKey);
          done();
      });
    });

  });

  describe('#getFileInfo', function() {

    it('should return internal error message to next', function(done) {
      var badFileId = 'myfile';
      request(app)
        .get('/buckets/' + bucketId + '/files/' + badFileId +'/info')
        .auth(user, hashedPassword)
        .expect(500)
        .end(function(err, res) {
          expect(err).to.equal(null);
          expect(res.res.statusMessage).to.equal('Internal Server Error');
          done();
      });
    });

    it('should return bucket information to res', function(done) {
      request(app)
        .get('/buckets/' + bucketId + '/files/' + fileId +'/info')
        .auth(user, hashedPassword)
        .expect(200)
        .end(function(err, res) {
          expect(err).to.equal(null);
          var body = res.body;
          expect(body.bucket).to.equal(bucketId);
          expect(body.mimetype).to.equal(mimetype);
          expect(body.filename).to.equal(fileName);
          expect(body.frame).to.equal(frameId);
          expect(body.id).to.equal(fileId);
          done();
      });
    });

  });

});