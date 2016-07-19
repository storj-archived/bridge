'use strict'

const expect = require('chai').expect;
const sinon = require('sinon');
const Config = require('../../lib/config')('devel').audits;
const proxyquire = require('proxyquire');

var testAudits = [
  {
    ts: Math.floor(new Date() / 1000),
    data: {
      id: 1,
      root: 1,
      depth: 1,
      challenge: 1,
      hash: 1
    }
  },
  {
    ts: Math.floor(new Date() / 1000),
    data: {
      id: 2,
      root: 2,
      depth: 2,
      challenge: 2,
      hash: 2
    }
  }
];

var stubRefs = {
  createClient: sinon.stub()
};

var clientStubs = {
  watch: sinon.stub(),
  multi: sinon.stub(),
  auth: sinon.stub(),
  ZADD: sinon.stub(),
  BRPOPLPUSH: sinon.stub(),
  LRANGE: sinon.stub(),
  ZRANGEBYSCORE: sinon.stub(),
  on: sinon.stub(),
  exec: sinon.stub()
};

clientStubs.multi.returns({
  exec: clientStubs.exec
})

stubRefs.createClient.returns(clientStubs);

var Queue = proxyquire('../../lib/audit/queue.js', {
  'redis' : {
    createClient: stubRefs.createClient
  }
});

stubRefs._get = sinon.stub(Queue.prototype, '_get');

describe('audit/queue', function() {
  var service = new Queue({test: 1}, 123);

  describe('@constructor', function() {
    it('should take a redis config object', function() {
      expect(service._config).to.include.keys('test');
    });

    it('should take a uuid', function() {
      expect(service._uuid).to.equal(123);
    });

    it('should set a default uuid of undefined', function() {
      service = new Queue({test: 1});
      expect(service._uuid).to.equal('undefined');
    });

    it('should create a redis client connection', function() {
      expect(stubRefs.createClient.called).to.be.true;
    });
  });

  describe('add', function() {
    var command;

    before(function(done) {
      clientStubs.ZADD.callsArgWith(1, null, 1);

      service.add(testAudits, function() {
        command = clientStubs.ZADD.args[0][0];
        done();
      });

    });

    it('should call the ZADD command', function() {
      expect(clientStubs.ZADD.called).to.be.true;
    });

    it('should call ZADD on the backlog key', function() {
      expect(command[0]).to.equal(service._keys.backlog);
    });

    it('should call ZADD with the NX flag', function() {
      expect(command[1]).to.equal('NX');
    });

    it('should call ZADD with the test audits', function() {
      expect(command[2]).to.equal(testAudits[0].ts);
      expect(command[3]).to.deep.equal(JSON.stringify(testAudits[0].data));

      expect(command[4]).to.equal(testAudits[1].ts);
      expect(command[5]).to.deep.equal(JSON.stringify(testAudits[1].data));
    });
  });

  describe('populateReadyQueue', function() {
    var command;
    var result;

    before(function(done) {
      clientStubs.watch.callsArgWith(1, null, 'OK');
      clientStubs.exec.callsArgWith(0, null, ['test', 1])
      stubRefs._get.callsArgWith(2, null, [])
      service.populateReadyQueue(null, null, function(err, success) {
        result = success;
        done();
      });
    });

    it('should watch the backlog for changes', function() {
      expect(clientStubs.watch.args[0][0]).to.equal(service._keys.backlog);
    });

    it('should call _get on the backlog', function() {
      expect(stubRefs._get.called).to.be.true;
    });

    it('should log and return false if nothing is ready', function() {
      expect(result).to.be.false;
      expect(clientStubs.multi.called).to.be.false;
    });

    it('should call multi command if items are ready', function() {
      stubRefs._get.callsArgWith(2, null, testAudits)
      service.populateReadyQueue(null, null, function(err, success) {
        result = success;
      });
      expect(clientStubs.multi.called).to.be.true;
    });

    it('should call the multi command with ZREMRANGEBYSCORE', function() {
      var startInd = clientStubs.multi.args[0][0][0];

      expect(startInd[0]).to.equal('ZREMRANGEBYSCORE');
      expect(startInd[1]).to.equal(service._keys.backlog);
      expect(startInd[2]).to.equal(0);
    });

    it('should call the RPUSH command', function() {
      var startInd = clientStubs.multi.args[0][0][1];

      expect(startInd[0]).to.equal('RPUSH');
      expect(startInd[1]).to.equal(service._keys.ready);
      expect(startInd[2]).to.deep.equal(testAudits[0]);
      expect(startInd[3]).to.deep.equal(testAudits[1]);
    });

    it('should call multi exec', function() {
      expect(clientStubs.exec.called).to.be.true;
    });

    it('should call the callback with true if items have been added to ready',
    function() {
      expect(result).to.be.true;
    });

    it('should retry while the transaction remains null', function() {
      clientStubs.exec.callsArgWith(0, null, null);
      clientStubs.exec.onCall(7).callsArgWith(0, null, ['test', 1]);
      service.populateReadyQueue(null, null, function(err, success) {
        result = success;
      });

      expect(clientStubs.exec.callCount).to.equal(8);
    });

  });

  describe('popReadyQueue', function() {
    before(function() {
      service.popReadyQueue(function() {});
    });

    it('should call the BRPOPLPUSH commands', function() {
      expect(clientStubs.BRPOPLPUSH.called).to.be.true;
    });
  });

  describe('getPendingQueue', function() {
    before(function() {
      service.getPendingQueue(function() {});
    });

    it('should call the LRANGE command', function() {
      expect(clientStubs.LRANGE.called).to.be.true;
    });
  });

  describe('pushResultQueue', function() {
    var result;

    beforeEach(function(){
      clientStubs.multi = sinon.stub();
      clientStubs.exec = sinon.stub();
      clientStubs.watch = sinon.stub();

      clientStubs.multi.returns({
        exec: clientStubs.exec
      });

      clientStubs.watch.callsArgWith(1, null, 'OK');
      clientStubs.exec.callsArgWith(0, null, [2, 2])

      service.pushResultQueue(testAudits[0], true, function(err, success) {
        result = success;
      });
    });

    it('should watch the pending queue', function() {
      expect(clientStubs.watch.args[0][0]).to.equal(service._keys.pending);
    });

    it('should place items on the passed queue when true is passed', function() {
      expect(clientStubs.multi.args[0][0][1][1]).to.equal('storj:audit:full:pass');
    });

    it('should execute the LREM command via multi', function() {
      var baseArgs = clientStubs.multi.args[0][0][0];

      expect(baseArgs[0]).to.equal('LREM');
      expect(baseArgs[1]).to.equal('storj:audit:full:pending:undefined');
      expect(baseArgs[2]).to.equal(1);
      expect(baseArgs[3]).to.deep.equal(testAudits[0]);
    });

    it('should execute the SADD command via multi', function() {
      var baseArgs = clientStubs.multi.args[0][0][1];

      expect(baseArgs[0]).to.equal('SADD');
      expect(baseArgs[2]).to.deep.equal(testAudits[0]);
    });

    it('should retry while the transaction remains null', function() {
      clientStubs.exec.callsArgWith(0, null, null);
      clientStubs.exec.onCall(5).callsArgWith(0, null, [2, 2])

      service.pushResultQueue(testAudits[0], false, function(err, success) {
        result = success;
      });

      expect(clientStubs.exec.callCount).to.equal(6);
    });

    it('should place items on the failed queue when false is passed', function(done) {
      service.pushResultQueue(testAudits[0], false, function(err, success) {
        expect(clientStubs.multi.args[1][0][1][1]).to.equal('storj:audit:full:fail');
        done();
      });


    });
  });

  describe('_get', function() {
    before(function() {
      stubRefs._get.restore();
      service._get(0, 0, function(err, audits){});
    });

    it('should call the ZRANGEBYSCORE command', function() {
      var baseArgs = clientStubs.ZRANGEBYSCORE.args[0][0];
      expect(clientStubs.ZRANGEBYSCORE.called).to.be.true;
      expect(baseArgs[0]).to.equal(service._keys.backlog)
      expect(baseArgs[1]).to.equal(0)
      expect(baseArgs[2]).to.equal(0)
    });
  });

});
