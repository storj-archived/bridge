'use strict';

const constants = require('../../../lib/constants');
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const errors = require('storj-service-error-types');
const EventEmitter = require('events').EventEmitter;
const ReportsRouter = require('../../../lib/server/routes/reports');

describe('ReportsRouter', function() {

  var reportsRouter = new ReportsRouter(
    require('../../_fixtures/router-opts')
  );

  describe('#createExchangeReport', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(function() {
      sandbox.restore();
    });

    it('should return internal error if save fails', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, [{}]);

      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, new Error('Failed to save report'));
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        expect(err.message).to.equal('Failed to save report');
        done();
      });
    });

    it('should give error if datahash does not exist', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, []);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        var save = reportsRouter.storage.models.ExchangeReport.prototype.save;
        expect(save.callCount).to.equal(0);
        done();
      });
    });

    it('should give error if datahash does not exist', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, null);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        var save = reportsRouter.storage.models.ExchangeReport.prototype.save;
        expect(save.callCount).to.equal(0);
        done();
      });
    });

    it('should give error if datahash does not exist', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, new Error('Internal error'));
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        var save = reportsRouter.storage.models.ExchangeReport.prototype.save;
        expect(save.callCount).to.equal(0);
        done();
      });
    });

    it('should send 201 if report saved', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          reporterId: storj.utils.rmd160('client'),
          farmerId: storj.utils.rmd160('farmer'),
          clientId: storj.utils.rmd160('client'),
          dataHash: storj.utils.rmd160('data'),
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.Shard,
        'find'
      ).callsArgWith(2, null, [{}]);
      sandbox.stub(
        reportsRouter.storage.models.ExchangeReport.prototype,
        'save'
      ).callsArgWith(0, null);
      response.on('end', function() {
        expect(response.statusCode).to.equal(201);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

  });

  describe('#_handleExchangeReport', function() {

    let _triggerMirrorEstablish;

    before(() => {
      _triggerMirrorEstablish = sinon.stub(
        reportsRouter,
        '_triggerMirrorEstablish'
      ).callsArg(2);
    });
    after(() => _triggerMirrorEstablish.restore());

    it('should callback error if not valid report type', function(done) {
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'NOT_VALID'
      }, (err) => {
        expect(err.message).to.equal(
          'Exchange result type will not trigger action'
        );
        done();
      });
    });

    it('should trigger a mirror on SHARD_UPLOADED', function(done) {
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'SHARD_UPLOADED'
      }, done);
    });

    it('should trigger a mirror on MIRROR_SUCCESS', function(done) {
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'MIRROR_SUCCESS'
      }, done);
    });

    it('should trigger a mirror on DOWNLOAD_ERROR', function(done) {
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'DOWNLOAD_ERROR'
      }, done);
    });

  });

  describe('@_sortByResponseTime', function() {
    it('will sort correctly with best response time at index 0', function() {
      var available = [
        { contact: { responseTime: 10100 }},
        { contact: {} },
        { contact: { responseTime: 100 }},
        { contact: {} },
        { contact: { responseTime: 200 }},
        { contact: { responseTime: 4100 }},
        { contact: { responseTime: 2100 }}
      ];
      available.sort(ReportsRouter._sortByResponseTime);
      expect(available).to.eql([
        { contact: { responseTime: 100 }},
        { contact: { responseTime: 200 }},
        { contact: { responseTime: 2100 }},
        { contact: { responseTime: 4100 }},
        { contact: { responseTime: 10100}},
        { contact: {}},
        { contact: {}}
      ]);
    });
  });

  describe('#_triggerMirrorEstablish', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    const n = constants.M_REPLICATE;
    const hash = storj.utils.rmd160('');

    it('should successfully replicate the shard', function(done) {
      sandbox.spy(Array.prototype, 'sort');
      const mirrors = [
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: null, // populated contact field not found
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: true
        }),
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: new reportsRouter.storage.models.Contact({
            _id: storj.utils.rmd160('node1'),
            address: '0.0.0.0',
            port: 1234,
            protocol: '1.0.0',
            lastSeen: Date.now(),
            userAgent: 'test'
          }),
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: true
        }),
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: new reportsRouter.storage.models.Contact({
            _id: storj.utils.rmd160('node2'),
            address: '0.0.0.0',
            port: 1234,
            protocol: '1.0.0',
            lastSeen: Date.now(),
            userAgent: 'test'
          }),
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: false
        })
      ];
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, mirrors)
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(n, hash, function(err) {
        expect(err).to.equal(null);
        expect(Array.prototype.sort.callCount).to.equal(1);
        expect(Array.prototype.sort.args[0][0])
          .to.equal(ReportsRouter._sortByResponseTime);
        done();
      });
    });

    it('should error if net mirroring fails', function(done) {
      var _mirrorFind = sinon.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      var _contractsLoad = sinon.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      var _getContactById = sinon.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      var _getRetrievalPointer = sinon.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      var _getMirrorNodes = sinon.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, new Error('Failed to mirror data'));
      var _contractsSave = sinon.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(n, hash, function(err) {
        _mirrorFind.restore();
        _contractsLoad.restore();
        _getContactById.restore();
        _getRetrievalPointer.restore();
        _getMirrorNodes.restore();
        _contractsSave.restore();
        expect(err.message).to.equal('Failed to mirror data');
        done();
      });
    });

    it('should error if no pointer can be retrieved', function(done) {
      var _mirrorFind = sinon.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      var _contractsLoad = sinon.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      var _getContactById = sinon.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      var _getRetrievalPointer = sinon.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, new Error('Failed to retrieve pointer'));
      var _getMirrorNodes = sinon.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      var _contractsSave = sinon.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(n, hash, function(err) {
        _mirrorFind.restore();
        _contractsLoad.restore();
        _getContactById.restore();
        _getRetrievalPointer.restore();
        _getMirrorNodes.restore();
        _contractsSave.restore();
        expect(err.message).to.equal('Failed to get pointer');
        done();
      });
    });

    it('should error if no pointer can be retrieved', function(done) {
      var _mirrorFind = sinon.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      var _contractsLoad = sinon.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      var _getContactById = sinon.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, new Error('Contact not found'));
      var _getRetrievalPointer = sinon.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      var _getMirrorNodes = sinon.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      var _contractsSave = sinon.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(n, hash, function(err) {
        _mirrorFind.restore();
        _contractsLoad.restore();
        _getContactById.restore();
        _getRetrievalPointer.restore();
        _getMirrorNodes.restore();
        _contractsSave.restore();
        expect(err.message).to.equal('Failed to get pointer');
        done();
      });
    });
    it('should error if the contract cannot load', function(done) {
      var _mirrorFind = sinon.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var _contractsLoad = sinon.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Failed to load contract'));
      var _getContactById = sinon.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      var _getRetrievalPointer = sinon.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      var _getMirrorNodes = sinon.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      var _contractsSave = sinon.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(n, hash, function(err) {
        _mirrorFind.restore();
        _contractsLoad.restore();
        _getContactById.restore();
        _getRetrievalPointer.restore();
        _getMirrorNodes.restore();
        _contractsSave.restore();
        expect(err.message).to.equal('Failed to load contract');
        done();
      });
    });

    it('should error if the mirror limit is reached', function(done) {
      var _mirrorFind = sinon.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      var _contractsLoad = sinon.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      var _getContactById = sinon.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      var _getRetrievalPointer = sinon.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      var _getMirrorNodes = sinon.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      var _contractsSave = sinon.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(0, hash, function(err) {
        _mirrorFind.restore();
        _contractsLoad.restore();
        _getContactById.restore();
        _getRetrievalPointer.restore();
        _getMirrorNodes.restore();
        _contractsSave.restore();
        expect(err.message).to.equal('Auto mirroring limit is reached');
        done();
      });
    });

    it('should error if no mirrors are available', function(done) {
      var _mirrorFind = sinon.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      var _contractsLoad = sinon.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      var _getContactById = sinon.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      var _getRetrievalPointer = sinon.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      var _getMirrorNodes = sinon.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      var _contractsSave = sinon.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      reportsRouter._triggerMirrorEstablish(n, hash, function(err) {
        _mirrorFind.restore();
        _contractsLoad.restore();
        _getContactById.restore();
        _getRetrievalPointer.restore();
        _getMirrorNodes.restore();
        _contractsSave.restore();
        expect(err.message).to.equal('No available mirrors');
        done();
      });
    });

  });

});
