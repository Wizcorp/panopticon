var Panopticon = require(__dirname + '/../index');
var cluster = require('cluster');

var now = Date.now();

exports['test count static method'] = function (test) {
	Panopticon._resetCount();
	test.expect(1);

	var panoptica = [];
	var count = 10;

	for (var i = 0; i < count; i += 1) {
		panoptica.push(new Panopticon({
			startTime: now,
			name: i,
			interval: 1000,
			scaleFactor: 1
		}));
	}

	test.strictEqual(Panopticon.count(), count);

	panoptica.forEach(function (panopticon) {
		panopticon.stop();
	});

	test.done();
};

exports['check correct addition and subtraction of listeners on cluster'] = function (test) {
	test.expect(2);

	var panoptica = [];
	var count = 10;

	var initialListeners = cluster.listeners('fork').length;

	for (var i = 0; i < count; i += 1) {
		panoptica.push(new Panopticon({
			startTime: now,
			name: i,
			interval: 1000,
			scaleFactor: 1
		}));
	}

	var beforeListeners = cluster.listeners('fork').length;

	test.strictEqual(beforeListeners, initialListeners + count);

	panoptica.forEach(function (panopticon) {
		panopticon.stop();
	});

	var afterListeners = cluster.listeners('fork').length;

	test.strictEqual(afterListeners, initialListeners);
	test.done();
};

exports['instantiation without interval is treated as 10000ms'] = function (test) {
	test.expect(1);

	var panopticon = new Panopticon({ name: 'testSingle' });

	test.strictEqual(panopticon.interval, 10000);

	panopticon.stop();

	test.done();
};

exports['test delivery'] = function (test) {
	test.expect(4);

	var interval = 25;

	var panopticon = new Panopticon({
		startTime: Date.now(),
		name: 'testDelivery',
		interval: interval,
		scaleFactor: 1,
		persist: false
	});

	var intervals = 0;

	var timeOut = setTimeout(function () {
		panopticon.stop();

		test.ok(false, 'delivery timed out');
		test.done();
	}, 1300);

	panopticon.set(null, 'should get removed', 'some info');

	panopticon.on('delivery', function (data) {
		intervals += 1;

		if (intervals === 1) {
			panopticon.set(null, 'should also get removed', 'some info');
		}

		if (intervals !== 3) {
			return;
		}

		test.ok(typeof data === 'object', 'panopticon.delivery should yield an object');
		test.strictEqual(data.id, panopticon.id, 'id in delivery should match panopticon.id');
		test.strictEqual(data.interval, interval, 'interval of delivery should match panopticon.interval');
		test.ok(data.data.hasOwnProperty('master') && JSON.stringify(data.data.master) === '{}', 'non-persistent panopticon should have empty data if no data was acquired in last interval, got ' + JSON.stringify(data.data.master, null, '  '));

		panopticon.stop();
		clearTimeout(timeOut);
		timeOut = null;

		test.done();
	});
};

exports['test api'] = function (test) {
	var interval = 200;
	var scaleFactor = 1;

	var panopticon = new Panopticon({
		startTime: Date.now(),
		name: 'testApi',
		interval: interval,
		scaleFactor: scaleFactor,
		persist: true
	});

	var counter = 0;

	var timeOut = setTimeout(function () {
		panopticon.stop();
		test.done();
	}, 160);

	panopticon.set(null, 'testSet', 'someData');
	panopticon.sample([], 'testSample', 0.5);

	var threeHalvesTime = setTimeout(function () {
		panopticon.inc(['incPath'], 'testInc', 1);

		//panopticon.set([], 'testSet', 'someData');
		panopticon.timedSample(['samplePath', 'sampleSubPath'], 'testTSample', [1, 0]);
		panopticon.timedSample(['samplePath', 'sampleSubPath'], 'testTSample', [1, 0]);
	}, 135);

	panopticon.on('delivery', function (data) {
		test.expect();

		if (counter !== 2) {
			counter += 1;
			return;
		}

		panopticon.stop();

		clearTimeout(timeOut);
		clearTimeout(threeHalvesTime);

		test.strictEqual(data.name, 'testApi', 'the name of delivered data was incorrect');
		test.strictEqual(data.id, panopticon.id, 'id from data and id of panopticon should match');
		test.strictEqual(data.data.master.testSet.value.val, 'someData');
		test.strictEqual(data.data.master.incPath.testInc.value.val, scaleFactor / interval);
		test.strictEqual(data.data.master.testSample.value.max, null);
		test.strictEqual(data.data.master.samplePath.sampleSubPath.testTSample.value.average, 1000);

		test.done();
	});
};

exports['test worker process panopticon'] = function (test) {
	test.expect(5);

	// Simple way of faking being on a cluster worker.
	cluster.isWorker = true;
	cluster.isMaster = false;

	var messages = 0;
	var id;
	var expected;

	// process.send is not a method on the master process. We can safely monkey patch it.
	process.send = function (message) {
		if (message.event !== 'workerSample') { // Not the droids you're looking for.
			return;
		}

		test.deepEqual(message, expected);

		// Do this test 5 times.
		if (messages < 4) {
			messages += 1;
			return;
		}

		panopticon.stop();

		// Return cluster module to normal.
		cluster.isWorker = false;
		cluster.isMaster = true;

		// The patch is no longer needed, so we remove it.
		delete process.send;

		return test.done();
	};

	var panopticon = new Panopticon({
		startTime: Date.now(),
		name: 'testSet',
		interval: 100,
		scaleFactor: 1,
		persist: true
	});

	id = panopticon.id;

	expected = {
		event: 'workerSample',
		sample: {},
		id: id
	};
};

exports['try cluster'] = function (test) {
	test.expect(7);

	Panopticon._resetCount();
	var start = Date.now();

	var panopticon = new Panopticon({
		startTime: start,
		name: 'testSet',
		interval: 100,
		scaleFactor: 1,
		persist: true
	});

	panopticon.inc(['incpath'], 'testInc', 1);

	var count = 0;

	cluster.setupMaster({
		exec: __dirname + '/scripts/worker.js',
		args: [start],
		silent: false
	});

	var worker1 = cluster.fork();
	var worker2 = cluster.fork();

	panopticon.on('delivery', function (data) {
		if (count !== 1) {
			count += 1;
			return;
		}

		test.ok(data.data.workers);
		test.strictEqual(Object.keys(data.data.workers).length, 2);
		test.ok(data.data.workers[worker1.id]);
		test.ok(data.data.workers[worker2.id]);

		var workerData1 = data.data.workers[worker1.id];
		var workerData2 = data.data.workers[worker2.id];

		test.strictEqual(workerData1['my name is'].value.val, 'slim shady');
		test.strictEqual(workerData2['my name is'].value.val, 'slim shady');

		worker1.destroy();
		worker2.destroy();
	});

	var disconnects;

	cluster.on('disconnect', function () {
		if (!disconnects) {
			disconnects = true;
			return;
		}

		panopticon.stop();

		test.ok(true);
		test.done();
	});
};

exports['bad sample should add no data'] = function (test) {
	test.expect(1);

	var panopticon = new Panopticon({
		startTime: Date.now(),
		name: 'badSample',
		interval: 100,
		scaleFactor: 1,
		persist: true
	});

	panopticon.sample([], 'a sample', 'junk');

	panopticon.on('delivery', function (data) {
		panopticon.stop();

		test.strictEqual(JSON.stringify(data.data.master), '{}');
		test.done();
	});
};

exports['bad timed sample should add no data'] = function (test) {
	test.expect(1);

	var panopticon = new Panopticon({
		startTime: Date.now(),
		name: 'badTimedSample',
		interval: 100,
		scaleFactor: 1,
		persist: true
	});

	panopticon.timedSample([], 'a timed sample', 'junk');

	panopticon.on('delivery', function (data) {
		panopticon.stop();

		test.strictEqual(JSON.stringify(data.data.master), '{}');
		test.done();
	});
};

exports['get the list of registered functions'] = function (test) {
	test.expect(5);

	var methods = Panopticon.getLoggerMethodNames();

	test.strictEqual(methods.length, 4);
	test.notStrictEqual(methods.indexOf('sample'), -1);
	test.notStrictEqual(methods.indexOf('timedSample'), -1);
	test.notStrictEqual(methods.indexOf('inc'), -1);
	test.notStrictEqual(methods.indexOf('set'), -1);

	test.done();
};

exports['overwriting a prototype property with a registration should throw'] = function (test) {
	test.expect(1);

	test.throws(function () {
		Panopticon.registerMethod('stop', function () {});
	});

	test.done();
};

exports['overwriting a registered method with a registration should throw'] = function (test) {
	test.expect(1);

	test.throws(function () {
		Panopticon.registerMethod('sample', function () {});
	});

	test.done();
};

exports['attempting to register a non-function method should throw'] = function (test) {
	test.expect(1);

	test.throws(function () {
		Panopticon.registerMethod('hello', null);
	});

	test.done();
};

exports['forgetting \'new\' should be ok'] = function (test) {
	/* jshint newcap: false */
	test.expect(1);

	var panopticon = Panopticon({
		startTime: now,
		name: 'noName',
		interval: 1000,
		scaleFactor: 1
	});

	test.ok(panopticon instanceof Panopticon);

	// Need to call stop to cancel event listeners.
	panopticon.stop();

	test.done();
};
