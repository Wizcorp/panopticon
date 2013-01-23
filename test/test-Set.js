var EventEmitter = require('events').EventEmitter;
var SetClass = require(__dirname + '/../Set');

function seDes(obj) {
	return JSON.parse(JSON.stringify(obj));
}

var now = Date.now();
var next = now + 10000;
var testString = 'testString';
var nextTestString = 'anotherTestString';

exports['check that JSON parsing yields the correct object'] = function (test) {
	test.expect();


	var expected = {
		type: 'set',
		value: {
			val: testString,
			timeStamp: now
		}
	};

	var set = new SetClass(testString, now);
	var actual = seDes(set);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check that JSON parsing yields the correct object after an update'] = function (test) {
	test.expect(1);

	var now = Date.now();
	var set = new SetClass(testString, now);

	var expected = {
		type: 'set',
		value: {
			val: nextTestString,
			timeStamp: next
		}
	};

	set.update(nextTestString, next);
	var actual = seDes(set);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check that JSON parsing yields the correct object after a reset'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var set = new SetClass(testString, now, emitter);

	emitter.emit('reset', next);

	var expected = {
		type: 'set',
		value: {
			val: testString,
			timeStamp: next
		}
	};

	var actual = seDes(set);

	test.deepEqual(actual, expected);
	test.done();
};