var Panopticon = require(__dirname + '/../index');
var cluster = require('cluster');

var now = Date.now();

exports['test count static method'] = function (test) {
	test.expect(1);

	var panoptica = [];
	var count = 10;

	for (var i = 0; i < count; i++) {
		panoptica.push(new Panopticon(now, i, 1000, 1, null, null));
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

	for (var i = 0; i < count; i++) {
		panoptica.push(new Panopticon(now, i, 1000, 1, null, null));
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

	var panopticon = new Panopticon(null, 'testSingle', null, null, null, null);

	test.strictEqual(panopticon.interval, 10000);

	panopticon.stop();

	test.done();
};

exports['test delivery'] = function (test) {
	test.expect(4);
	var interval = 25;

	var panopticon = new Panopticon(Date.now(), 'testDelivery', interval, 1, false, null);
	var intervals = 0;

	var timeOut = setTimeout(function () {
		panopticon.stop();

		test.ok(false, 'delivery timed out');
		test.done();
	}, 1300);

	//panopticon.set(null, 'should get removed', 'some info');

	panopticon.on('delivery', function (data) {
		intervals += 1;

		if (intervals === 1) {
			panopticon.set(null, 'should get removed', 'some info');
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

	var panopticon = new Panopticon(Date.now(), 'testApi', interval, scaleFactor, true, null);
	var counter = 0;

	var timeOut = setTimeout(function () {
		panopticon.stop();
		test.done();
	}, 160);

	//var halfTime = setTimeout(function () {
	panopticon.set(null, 'testSet', 'someData');
		//panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', [1, 0]);
		//panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', null);
	panopticon.sample([], 'testSample', 0.5);
		//panopticon.sample([], 'testSample', null);
	//}, 10);

	var threeHalvesTime = setTimeout(function () {
		panopticon.inc(['incPath'], 'testInc', 1);

		//panopticon.set([], 'testSet', 'someData');
		panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', [1, 0]);
		panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', [1, 0]);
	}, 135);

	panopticon.on('delivery', function (data) {
		test.expect();

		if (counter !== 2) {
			counter += 1;
			return;
		}

		panopticon.stop();

		clearTimeout(timeOut);
		timeOut = null;
		//clearTimeout(halfTime);
		//halfTime = null;
		clearTimeout(threeHalvesTime);
		threeHalvesTime = null;

		test.strictEqual(data.name, 'testApi', 'the name of delivered data was incorrect');
		test.strictEqual(data.id, panopticon.id, 'id from data and id of panopticon should match');
		test.strictEqual(data.data.master.testSet.value.val, 'someData');
		test.strictEqual(data.data.master.incPath.testInc.value.val, scaleFactor / interval);
		test.strictEqual(data.data.master.testSample.value.max, null);
		test.strictEqual(data.data.master.timedSamplePath.timedSampleSubPath.testTimedSample.value.average, 1000);

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

	var panopticon = new Panopticon(Date.now(), 'testSet', 100, 1, true, null);
	
	id = panopticon.id;

	expected = {
		event: 'workerSample',
		sample: {},
		id: id
	};
};
/*
exports['handle early timeout firing'] = function (test) {
	test.expect(1);

	var panoptica = [];
	var count = 10;

	for (var i = 0; i < count; i++) {
		panoptica.push(new Panopticon(now, i, 1*(i*i), 1, null, null));
	}

	setTimeout(function () {
		panoptica.forEach(function (panopticon) {
			panopticon.stop();
		});
		test.ok(true);
		test.done();
	}, 1000);
};
*/
