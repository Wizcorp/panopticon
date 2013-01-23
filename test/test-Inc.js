var EventEmitter = require('events').EventEmitter;
var IncClass = require(__dirname + '/../Inc');

function seDes(obj) {
	return JSON.parse(JSON.stringify(obj));
}

var now = Date.now();
var next = now + 10000;

exports['check inc after JSON parsing'] = function (test) {
	test.expect(1);

	var expected = {
		type: 'inc',
		value: {
			val: 1,
			timeStamp: now
		}
	};

	var inc = new IncClass(1, now, null, 1, 1);
	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check null inc after JSON parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(null, now, null, 1, 1);

	var expected = {
		type: 'inc',
		value: {
			val: 1,
			timeStamp: now
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check 0 inc after JSON parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(0, now, null, 1, 1);

	var expected = {
		type: 'inc',
		value: {
			val: 0,
			timeStamp: now
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check 0 inc after increment and JSON parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(0, now, null, 1, 1);
	inc.update(0, next);

	var expected = {
		type: 'inc',
		value: {
			val: 0,
			timeStamp: next
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};