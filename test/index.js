var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var cluster = require('cluster');

var Panopticon = require('../');
var StandardDeviation = require('../StandardDeviation');
var Average = require('../Average');
var SetLog = require('../Set');
var IncLog = require('../Inc');
var SampleLog = require('../Sample');
var TimedSampleLog = require('../TimedSample');

var panoptica = [];
var testCount = 0;

// These are terminal formatting commands.
// var boldEsc = '\u001b[1m';
var resetEsc = '\u001b[0m';

function redLog() {
	console.log('\u001b[31m' + Array.prototype.join.call(arguments, ' ') + resetEsc);
}

function greenLog() {
	console.log('\u001b[32m' + Array.prototype.join.call(arguments, ' ') + resetEsc);
}

function shutdown(code) {
	panoptica.forEach(function (panopticon) {
		panopticon.stop();
	});

	if (!code) {
		greenLog('\nSuccessfully ran', testCount, 'tests.');
	}

	process.exit(code);
}

function handleAssert(assertFunc, args, message) {
	try {
		assertFunc.apply(null, args);
	} catch (e) {
		if (e.name !== 'AssertionError') {
			throw e;
		}

		redLog('✗', message, 'expected\n' + JSON.stringify(e.expected, null, '  ') + '\nbut got\n' + JSON.stringify(e.actual, null, '  '));
		shutdown(1);
	}

	testCount += 1;
	greenLog('✔', message);
}

// seDes: serialise-deserialise (like modem)
function seDes(data) {
	return JSON.parse(JSON.stringify(data));
}

/*
 * Tests to write.
 *
 * Test the samplers via context. JSON.stringify and then JSON.parse them to get processed results.
 *  - Average
 *  - Standard Deviation
 *  - Set
 *  - Inc
 *  - Sample
 *  - TimedSample
 *
 * Test panopticon using a normal module require. VM is apparently flakey so the above is as far
 * as we want to go with it.
 *
 * Emission from panopticon in non-cluster mode.
 *  - First emission approximately on time.
 *  - Subsequent emissions at regular intervals.
 * Arbitrary path assignment.
 *
 */

/**
 * Test auxiliary constructors.
 */
function statisticsTests() {
	// A small number of samples should lead to a large and unique standard deviation. The single
	// pass method that is used comes at a trade off in accuracy.
	function testStandardDeviation(samples) {
		var standardDeviation = new StandardDeviation(1);
		var expected = null;
		var actual = seDes(standardDeviation);

		// Standard deviation cannot be calculated for a single sample.
		handleAssert(assert.strictEqual, [actual, expected], 'singleSampleSigmaAfterParse');

		standardDeviation.addMeasurement(1);
		expected = 0;
		actual = seDes(standardDeviation);

		// For two samples standard deviation is defined.
		handleAssert(assert.strictEqual, [actual, expected], 'twoSamplesSigmaAfterParse');

		var testArray = [];
		for (var i = 0; i < samples; i += 1) {
			testArray.push(Math.random() * 100 - 50);
		}

		// The algorithm here is a raw version of the one found in the module. It's written as
		// closely to the algorithm as possible.
		function sigma(arr) {
			var n = 0;
			var mean = 0;
			var M2 = 0;

			arr.forEach(function (sample) {
				n += 1;
				var delta = sample - mean;
				mean += delta / n;
				M2 += delta * (sample - mean);
			});

			return Math.sqrt(M2 / (n - 1));
		}

		expected = sigma(testArray);

		standardDeviation = new StandardDeviation(testArray.shift());
		testArray.forEach(function (sample) {
			standardDeviation.addMeasurement(sample);
		});

		actual = seDes(standardDeviation);

		handleAssert(assert.strictEqual, [actual, expected], 'checkSigmaAfterParse ' + samples);
	}

	function testAverage() {
		var length = 1000;
		var i;

		// Test 1. Trivial averaging.
		var testArray = [];
		for (i = 0; i < length; i += 1) {
			testArray[i] = Math.random() * 100 - 50;
		}

		var expected = testArray.reduce(function (sum, elem) {
			return sum + elem;
		}, 0) / length;

		var average = new Average(testArray[0]);
		for (i = 1; i < length; i += 1) {
			average.addMeasurement(testArray[i]);
		}

		var actual = seDes(average);

		handleAssert(assert.strictEqual, [actual, expected], 'checkAverageAfterParse');
	}

	testStandardDeviation(10);
	testStandardDeviation(100);
	testStandardDeviation(1000);
	testAverage();
}

function auxClassTests() {
	function testSet() {
		var now = Date.now();
		var testString = 'testString';

		var expected = {
			type: 'set',
			value: {
				val: testString,
				timeStamp: now
			}
		};

		var set = new SetLog(testString, now);
		var actual = seDes(set);

		handleAssert(assert.deepEqual, [actual, expected], 'checkSetAfterParse');

		var nextTestString = 'anotherTestString';
		var next = now + 10;

		expected.value.val = nextTestString;
		expected.value.timeStamp = next;

		set.update(nextTestString, next);
		actual = seDes(set);

		handleAssert(assert.deepEqual, [actual, expected], 'checkSetAfterUpdateAndParse');

		var emitter = new EventEmitter();

		set = new SetLog(testString, now, emitter);

		emitter.emit('reset', next);

		expected = {
			type: 'set',
			value: {
				val: testString,
				timeStamp: next
			}
		};

		actual = seDes(set);

		handleAssert(assert.deepEqual, [actual, expected], 'checkSetAfterReset');
	}

	function testInc() {
		var now = Date.now();

		var expected = {
			type: 'inc',
			value: {
				val: 1,
				timeStamp: now
			}
		};

		var inc = new IncLog(1, now, null, 1, 1);
		var actual = seDes(inc);

		// Basic initialisation.
		handleAssert(assert.deepEqual, [actual, expected], 'checkIncAfterParse');

		inc = new IncLog(null, now, null, 1, 1);
		actual = seDes(inc);

		// Initialising without a finite number should treat initial value as 1.
		handleAssert(assert.deepEqual, [actual, expected], 'checkNullIncAfterParse');

		expected.value.val = 0;
		inc = new IncLog(0, now, null, 1, 1);
		actual = seDes(inc);

		// Initialising with 0 should set the initial value as 0.
		handleAssert(assert.deepEqual, [actual, expected], 'checkZeroIncAfterParse');

		var next = now + 10;
		inc.update(0, next);

		expected.value.val = 0;
		expected.value.timeStamp = next;

		actual = seDes(inc);

		// Incrementing by zero should result in no change.
		handleAssert(assert.deepEqual, [actual, expected], 'checkZeroIncAfterIncrementParse');

		expected.value.val = 1;
		expected.value.timeStamp = now;

		inc.update(1, now);
		actual = seDes(inc);

		// Incrementing by one should add one from the value.
		handleAssert(assert.deepEqual, [actual, expected], 'checkIncrementedIncAfterParse');

		expected.value.val = 0;
		expected.value.timeStamp = now;

		inc.update(-1, now);
		actual = seDes(inc);

		// Decrementing by one should take one from the value.
		handleAssert(assert.deepEqual, [actual, expected], 'checkDecrementedIncAfterParse');

		expected.value.val = 2;
		expected.value.timeStamp = next;

		inc.update(2, next);
		actual = seDes(inc);

		// Incrememting by two should add two to the value.
		handleAssert(assert.deepEqual, [actual, expected], 'checkIncrementByTwoIncAfterParse');

		expected.value.val = 3;
		expected.value.timeStamp = now;

		inc.update("junk", now);
		actual = seDes(inc);

		// Incrementing with something other than a number treats is treated as adding one.
		handleAssert(assert.deepEqual, [actual, expected], 'checkJunkIncAfterParse');

		inc = new IncLog(1, now, null, 0.1, 1);
		expected.value.val = 0.1;
		actual = seDes(inc);

		// A scale factor of 0.1 should multiply the value by 0.1.
		handleAssert(assert.deepEqual, [actual, expected], 'checkScaledIncAfterParse');

		var emitter = new EventEmitter();
		inc = new IncLog(1, now, emitter, 1, 0.1);
		expected.value.val = 10;
		actual = seDes(inc);

		// An interval of 0.1 should multiply the value by 0.1.
		handleAssert(assert.deepEqual, [actual, expected], 'checkIntervalIncAfterParse');

		emitter.emit('reset', next);

		expected.value.val = 0;
		expected.value.timeStamp = next;

		actual = seDes(inc);

		// A reset inc should have a value of 0.
		handleAssert(assert.deepEqual, [actual, expected], 'checkIntervalIncAfterReset');
	}

	function testSample() {
		var now = Date.now();
		var next = now + 10;
		var emitter = new EventEmitter();
		var sample = new SampleLog(1, now, null);
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

		// First test without persistObj, for branch checking.
		handleAssert(assert.deepEqual, [actual, expected], 'checkSingleSampleAfterParseWithoutPersist');
		
		sample = new SampleLog(1, now, emitter);
		actual = seDes(sample);

		// A single sample should give a null standard deviation, and same max, min and average.
		handleAssert(assert.deepEqual, [actual, expected], 'checkSingleSampleAfterParse');

		sample.update(1, now);
		actual = seDes(sample);

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

		// Add an identicle sample. null, all properties should now be the same, with 0 deviation.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTwoSamplesAfterParse');

		emitter.emit('reset', next);
		actual = seDes(sample);

		expected.value = {
			min: null,
			max: null,
			sigma: null,
			average: null,
			timeStamp: next
		};

		// Reset the object and check that the internal state is that expected.
		handleAssert(assert.deepEqual, [actual, expected], 'checkAfterReset');

		sample.update(2, now);
		sample.update(2, now);
		actual = seDes(sample);

		expected.value = {
			min: 2,
			max: 2,
			sigma: 0,
			average: 2,
			timeStamp: now
		};

		// Check that sigmas are reinitialised on update after a reset.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTwoSamplesAfterReset');
	}

	function testTimedSample() {
		var now = Date.now();
		var next = now + 10;
		var emitter = new EventEmitter();
		var timedSample = new TimedSampleLog([1, 0], now, null, 1);
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

		// First test without a persistObj, for branch checking.
		handleAssert(assert.deepEqual, [actual, expected], 'checkSingleTimedSampleAfterParseWithoutPersist');

		timedSample = new TimedSampleLog([1, 0], now, emitter, 1);
		actual = seDes(timedSample);
		
		// A single sample should give a null standard deviation, and same max, min and average.
		handleAssert(assert.deepEqual, [actual, expected], 'checkSingleTimedSampleAfterParse');

		timedSample.update([1, 0]);
		actual = seDes(timedSample);
		expected = {
			type: 'timedSample',
			value: {
				min: 1000,
				max: 1000,
				sigma: 0,
				average: 1000,
				scaleFactor: 1
			}
		};

		// Add an identicle sample. null, all properties should now be the same, with 0 deviation.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTwoTimedSamplesAfterParse');

		emitter.emit('reset', next);
		actual = seDes(timedSample);

		expected = {
			type: 'timedSample',
			value: {
				min: null,
				max: null,
				sigma: null,
				average: null,
				scaleFactor: 1,
				timeStamp: next
			}
		};

		// A reset sample should have the correct internal state.
		handleAssert(assert.deepEqual, [actual, expected], 'checkAfterReset');

		timedSample.update([1, 0], now);
		timedSample.update([1, 0], now);

		actual = seDes(timedSample);

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

		// Updates after a reset should properly initialise standard deviation and average.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTwoTimedSamplesAfterParse');
	}

	testSet();
	testInc();
	testSample();
	testTimedSample();
}

function panopticonTests(cb) {
	cluster.setMaxListeners(0);

	function testMultiple() {
		var now = Date.now();
		var panoptica = [];
		var count = 10;

		for (var i = 0; i < count; i++) {
			panoptica.push(new Panopticon(now, i, 1000, 1, null, null));
		}

		handleAssert(assert.strictEqual, [Panopticon.count(), count], 'checkPanopticaCount');

		panoptica.forEach(function (panopticon) {
			panopticon.stop();
		});
	}

	function testMissingInit() {
		var panopticon = new Panopticon(null, 'testSingle', null, null, null, null);
		var now = Date.now();

		handleAssert(assert.strictEqual, [panopticon.interval, 10000], 'checkDefaultInterval');
		handleAssert(assert.strictEqual, [panopticon.scaleFactor, 1], 'checkDefaultScaleFactor');

		// By default the startTimes will be an integer number of intervals. As the panopticon was
		// initialised in this tick, we can take the modulo of now with the interval size, and
		// subtract it from now to get the startTime.
		defaultStart = now - now % panopticon.interval;

		handleAssert(assert.strictEqual, [panopticon.endTime, defaultStart + 10000], 'checkDefaultStartTime');

		panopticon.stop();

		handleAssert(assert.strictEqual, [panopticon.timer, null], 'checkStop');
	}

	function testDelivery(cb) {
		var panopticon = new Panopticon(Date.now(), 'testDelivery', 50, 1, null, null);
		var intervals = 0;

		var timeOut = setTimeout(function () {
			panopticon.stop();
			handleAssert(assert.ok, [false], 'deliveryTimedOut');
			return cb();
		}, 170);

		panopticon.on('sample', function (data) {
			intervals += 1;
			
			if (intervals !== 3) {
				return;
			}

			clearTimeout(timeOut);
			timeout = null;

			handleAssert(assert.ok, [true], 'deliveryBeforeTimeout');
			handleAssert(assert.strictEqual, [typeof data === 'object' && Object.keys(data).length, 0], 'noInputYieldsEmptyData');
			
			panopticon.stop();

			return cb();
		});
	}

	function testPanopticonApi(cb) {
		var panopticon = new Panopticon(Date.now(), 'testSet', 50, 1, true, null);
		var counter = 0;

		var timeOut = setTimeout(function () {
			panopticon.stop();
			handleAssert(assert.ok, [false], 'deliveryTimedOut');
			return cb();
		}, 120);

		var halfTime = setTimeout(function () {
			panopticon.set(null, 'testSet', 'someData');
			panopticon.inc(['incPath'], 'testInc', 1);
			panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', [0, 1]);
			panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', null);
			panopticon.sample([], 'testSample', 0.5);
			panopticon.sample([], 'testSample', null);
		}, 25);

		var threeHalvesTime = setTimeout(function () {
			panopticon.set([], 'testSet', 'someData');
			panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', [0, 1]);
			panopticon.timedSample(['timedSamplePath', 'timedSampleSubPath'], 'testTimedSample', [0, 0.5]);
		}, 75);

		panopticon.on('sample', function (data) {
			if (counter !== 1) {
				counter += 1;
				return;
			}

			clearTimeout(timeOut);
			timeout = null;
			clearTimeout(halfTime);
			halfTime = null;

			var expected = {
				testSet: { type: 'set', value: { val: 'someData', timeStamp: 0 } },
				incPath: { testInc: { type: 'inc', value: { val: 0, timeStamp: 0 } } },
				timedSamplePath: { timedSampleSubPath: { testTimedSample: { type: 'timedSample', value: { val: null, timeStamp: 0 } } } },
				testSample: { testSample: { type: 'sample', value: { val: null, timeStamp: 0 } } }
			};

			var actual = seDes(data);

			handleAssert(assert.ok, [true], 'deliveryBeforeTimeout');
			handleAssert(assert.deepEqual, [Object.keys(actual), Object.keys(expected)], 'gotExpectedKeysWithPersistence');
			handleAssert(assert.strictEqual, [actual.testSet.type, 'set'], 'gotExpectedTypeForSet');
			handleAssert(assert.strictEqual, [actual.testSet.value.val, 'someData'], 'gotExpectedValForSet');
			handleAssert(assert.strictEqual, [actual.incPath.testInc.type, 'inc'], 'gotExpectedTypeForInc');
			handleAssert(assert.strictEqual, [actual.incPath.testInc.value.val, 0], 'gotExpectedValForInc');
			handleAssert(assert.strictEqual, [actual.timedSamplePath.timedSampleSubPath.testTimedSample.type, 'timedSample'], 'gotExpectedTypeForTimedSample');
			handleAssert(assert.strictEqual, [actual.timedSamplePath.timedSampleSubPath.testTimedSample.value.val, undefined], 'gotExpectedValForTimedSample');
			handleAssert(assert.strictEqual, [actual.testSample.type, 'sample'], 'gotExpectedTypeForSet');
			handleAssert(assert.strictEqual, [actual.testSample.value.val, undefined], 'gotExpectedValForSet');

			panopticon.stop();

			return cb();
		});
	}

	testMultiple();
	testMissingInit();
	testDelivery(
		testPanopticonApi(cb)
	);
}

statisticsTests();
auxClassTests();
panopticonTests(function () {
	shutdown(0);
});
