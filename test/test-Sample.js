var EventEmitter = require('events').EventEmitter;
var SampleClass = require(__dirname + '/../Sample');

function seDes(obj) {
	return JSON.parse(JSON.stringify(obj));
}

var now = Date.now();
var next = now + 10000;

exports['check single sample after parse without persist'] = function (test) {
	test.expect(1);

	var sample = new SampleClass(1, now, null);
	var actual = seDes(sample);

	var expected = {
		type: 'sample',
		value: {
			min: 1,
			max: 1,
			sigma: null,
			average: 1,
			timeStamp: now
		}
	};

	test.deepEqual(actual, expected);
	test.done();
};

exports['check single sample after parse with persist'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var sample = new SampleClass(1, now, emitter);
	var actual = seDes(sample);

	var expected = {
		type: 'sample',
		value: {
			min: 1,
			max: 1,
			sigma: null,
			average: 1,
			timeStamp: now
		}
	};

	test.deepEqual(actual, expected);
	test.done();
};

exports['check single sample after update and parse with persist'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var sample = new SampleClass(1, now, emitter);

	sample.update(1, now);
	var actual = seDes(sample);

	expected = {
		type: 'sample',
		value: {
			min: 1,
			max: 1,
			sigma: 0,
			average: 1,
			timeStamp: now
		}
	};

	test.deepEqual(actual, expected);
	test.done();
};

exports['check single sample after with persist and reset'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var sample = new SampleClass(1, now, emitter);

	sample.update(1, now);

	expected = {
		type: 'sample',
		value: {
			min: null,
			max: null,
			sigma: null,
			average: null,
			timeStamp: next
		}
	};

	emitter.emit('reset', next);
	var actual = seDes(sample);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check two samples reset'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var sample = new SampleClass(1, now, emitter);

	sample.update(1, now);

	var expected = {
		type: 'sample',
		value: {
			min: 2,
			max: 2,
			sigma: 0,
			average: 2,
			timeStamp: now
		}
	};

	emitter.emit('reset', next);

	sample.update(2, now);
	sample.update(2, now);

	var actual = seDes(sample);

	test.deepEqual(actual, expected);
	test.done();
};