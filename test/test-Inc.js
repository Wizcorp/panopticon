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

exports['check 0 inc after 0 increment and JSON parse'] = function (test) {
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

exports['check 0 inc after 0 increment and 1 increment and JSON parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(0, now, null, 1, 1);
	inc.update(0, next);
	inc.update(1, now);

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

exports['check 0 inc after 0 increment and 1 increment and 1 decrement and JSON parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(0, now, null, 1, 1);
	inc.update(0, next);
	inc.update(1, now);
	inc.update(-1, next);

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

exports['check increment by 2 and JSON parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(0, now, null, 1, 1);
	inc.update(2, next);

	var expected = {
		type: 'inc',
		value: {
			val: 2,
			timeStamp: next
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['increment by junk should be treated as increment by 1'] = function (test) {
	test.expect(1);

	var inc = new IncClass(0, now, null, 1, 1);
	inc.update('hfiurbn', next);

	var expected = {
		type: 'inc',
		value: {
			val: 1,
			timeStamp: next
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check scaled increment after parse'] = function (test) {
	test.expect(1);

	var inc = new IncClass(1, now, null, 0.1, 1);

	var expected = {
		type: 'inc',
		value: {
			val: 0.1,
			timeStamp: now
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check persisted increment and parse'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var inc = new IncClass(1, now, emitter, 1, 0.1);

	var expected = {
		type: 'inc',
		value: {
			val: 10,
			timeStamp: now
		}
	};

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};

exports['check persisted increment after reset and parse'] = function (test) {
	test.expect(1);

	var emitter = new EventEmitter();
	var inc = new IncClass(1, now, emitter, 1, 0.1);

	var expected = {
		type: 'inc',
		value: {
			val: 0,
			timeStamp: next
		}
	};

	emitter.emit('reset', next);

	var actual = seDes(inc);

	test.deepEqual(actual, expected);
	test.done();
};