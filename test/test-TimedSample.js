var EventEmitter = require('events').EventEmitter;
var TimedSampleClass = require(__dirname + '/../TimedSample');

function seDes(obj) {
	return JSON.parse(JSON.stringify(obj));
}

var now = Date.now();
var next = now + 10000;

exports['check single timed sample after parse without persist'] = function (test) {
	var timedSample = new TimedSampleClass([1, 0], now, null, 1);
	var actual = seDes(timedSample);

	var expected = {
		type: 'timedSample',
		value: {
			min: 1000,
			max: 1000,
			sigma: null,
			average: 1000,
			scaleFactor: 1,
			timeStamp: now
		}
	};

	test.deepEqual(actual, expected);
	test.done();
};

exports['check single timed sample after parse with persist'] = function (test) {
	var emitter = new EventEmitter();
	var timedSample = new TimedSampleClass([1, 0], now, emitter, 1);
	var actual = seDes(timedSample);

	var expected = {
		type: 'timedSample',
		value: {
			min: 1000,
			max: 1000,
			sigma: null,
			average: 1000,
			scaleFactor: 1,
			timeStamp: now
		}
	};

	test.deepEqual(actual, expected);
	test.done();
};

exports['check two timed samples after parse with persist'] = function (test) {
	var emitter = new EventEmitter();
	var timedSample = new TimedSampleClass([1, 0], now, emitter, 1);
	timedSample.update([1, 0], next);
	var actual = seDes(timedSample);

	var expected = {
		type: 'timedSample',
		value: {
			min: 1000,
			max: 1000,
			sigma: 0,
			average: 1000,
			scaleFactor: 1,
			timeStamp: next
		}
	};

	test.deepEqual(actual, expected);
	test.done();
};

exports['check parse after reset'] = function (test) {
	var emitter = new EventEmitter();
	var timedSample = new TimedSampleClass([1, 0], now, emitter, 1);
	timedSample.update([1, 0], next);

	var expected = {
		type: 'timedSample',
		value: {
			min: null,
			max: null,
			sigma: null,
			average: null,
			scaleFactor: 1,
			timeStamp: now
		}
	};

	emitter.emit('reset', now);
	var actual = seDes(timedSample);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check parse after reset and two samples'] = function (test) {
	var emitter = new EventEmitter();
	var timedSample = new TimedSampleClass([1, 0], now, emitter, 1);
	timedSample.update([1, 0], next);

	expected = {
		type: 'timedSample',
		value: {
			min: 1000,
			max: 1000,
			sigma: 0,
			average: 1000,
			scaleFactor: 1,
			timeStamp: now
		}
	};

	emitter.emit('reset', now);
	timedSample.update([1, 0], now);
	timedSample.update([1, 0], now);

	var actual = seDes(timedSample);

	test.deepEqual(actual, expected);
	test.done();
};