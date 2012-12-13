var assert = require('assert');
//var Panopticon = require('../');
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
		for (var i = 0; i < samples; i++) {
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
		for (i = 0; i < length; i++) {
			testArray[i] = Math.random() * 100 - 50;
		}

		var expected = testArray.reduce(function (sum, elem) {
			return sum + elem;
		}, 0) / length;

		var average = new Average(testArray[0]);
		for (i = 1; i < length; i++) {
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
		var expected = 'testString';
		var set = new SetLog(expected);
		var actual = seDes(set);

		handleAssert(assert.strictEqual, [actual, expected], 'checkSetAfterParse');

		expected = 'anotherTestString';
		set.update(expected);
		actual = seDes(set);

		handleAssert(assert.strictEqual, [actual, expected], 'checkSetAfterUpdateAndParse');

		set = new SetLog('testString', false, true);
		actual = seDes(set);
		expected = {
			type: 'set',
			value: 'testString'
		};

		handleAssert(assert.deepEqual, [actual, expected], 'checkTypedSetAfterUpdateAndParse');
	}

	function testInc() {
		var expected = 1;
		var inc = new IncLog(1, false, false, 1, 1);
		var actual = seDes(inc);

		// Basic initialisation.
		handleAssert(assert.strictEqual, [actual, expected], 'checkIncAfterParse');

		inc = new IncLog(null, false, false, 1, 1);
		actual = seDes(inc);

		// Initialising without a finite number should treat initial value as 1.
		handleAssert(assert.strictEqual, [actual, expected], 'checkNullIncAfterParse');

		expected = 0;
		inc = new IncLog(0, false, false, 1, 1);
		actual = seDes(inc);

		// Initialising with 0 should set the initial value as 0.
		handleAssert(assert.strictEqual, [actual, expected], 'checkNullIncAfterParse');

		inc.update(0);
		actual = seDes(inc);

		// Incrementing by zero should result in no change.
		handleAssert(assert.strictEqual, [actual, expected], 'checkZeroIncAfterParse');

		expected = 1;
		inc.update(1);
		actual = seDes(inc);

		// Incrementing by one should add one from the value.
		handleAssert(assert.strictEqual, [actual, expected], 'checkIncrementedIncAfterParse');

		expected = 0;
		inc.update(-1);
		actual = seDes(inc);

		// Decrementing by one should take one from the value.
		handleAssert(assert.strictEqual, [actual, expected], 'checkDecrementedIncAfterParse');

		expected = 2;
		inc.update(2);
		actual = seDes(inc);

		// Incrememting by two should add two to the value.
		handleAssert(assert.strictEqual, [actual, expected], 'checkIncrementByTwoIncAfterParse');

		expected = 3;
		inc.update("junk");
		actual = seDes(inc);

		// Incrementing with something other than a number treats is treated as adding one.
		handleAssert(assert.strictEqual, [actual, expected], 'checkJunkIncAfterParse');

		inc = new IncLog(1, false, false, 0.1, 1);
		expected = 0.1;
		actual = seDes(inc);

		// A scale factor of 0.1 should multiply the value by 0.1.
		handleAssert(assert.strictEqual, [actual, expected], 'checkScaledIncAfterParse');

		inc = new IncLog(1, false, false, 1, 0.1);
		expected = 10;
		actual = seDes(inc);

		// An interval of 0.1 should multiply the value by 0.1.
		handleAssert(assert.strictEqual, [actual, expected], 'checkIntervalIncAfterParse');

		inc = new IncLog(1, false, true, 1, 0.1);
		actual = seDes(inc);
		expected = {
			type: 'inc',
			value: 10
		};

		// Test that types are returned when we initialise with types turned on.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTypedIntervalIncAfterParse');
	}

	function testSample() {
		var sample = new SampleLog(1);
		var actual = seDes(sample);
		var expected = {
			min: 1,
			max: 1,
			sigma: null,
			average: 1
		};

		// A single sample should give a null standard deviation, and same max, min and average.
		handleAssert(assert.deepEqual, [actual, expected], 'checkSingleSampleAfterParse');

		sample.update(1);
		actual = seDes(sample);
		expected = {
			min: 1,
			max: 1,
			sigma: 0,
			average: 1
		};

		// Add an identicle sample. null, all properties should now be the same, with 0 deviation.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTwoSamplesAfterParse');

		sample = new SampleLog(1, false, true);
		actual = seDes(sample);
		expected = {
			type: 'sample',
			value: {
				min: 1,
				max: 1,
				sigma: null,
				average: 1
			}
		};

		// Check that type is returned with value when we have initialised with type on.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTypeSampleAfterParse');
	}

	function testTimedSample() {
		var timedSample = new TimedSampleLog([1, 0], false, false, 1);
		var actual = seDes(timedSample);
		var expected = {
			min: 1000,
			max: 1000,
			sigma: null,
			average: 1000,
			scaleFactor: 1
		};

		// A single sample should give a null standard deviation, and same max, min and average.
		handleAssert(assert.deepEqual, [actual, expected], 'checkSingleTimedSampleAfterParse');

		timedSample.update([1, 0]);
		actual = seDes(timedSample);
		expected = {
			min: 1000,
			max: 1000,
			sigma: 0,
			average: 1000,
			scaleFactor: 1
		};

		// Add an identicle sample. null, all properties should now be the same, with 0 deviation.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTwoTimedSamplesAfterParse');

		timedSample = new TimedSampleLog([1, 0], false, true, 1);
		actual = seDes(timedSample);
		expected = {
			type: 'timedSample',
			value: {
				min: 1000,
				max: 1000,
				sigma: null,
				average: 1000,
				scaleFactor: 1
			}
		};

		// Check that type is returned when we have initialised with types on.
		handleAssert(assert.deepEqual, [actual, expected], 'checkTypedTimedSampleAfterParse');
	}

	testSet();
	testInc();
	testSample();
	testTimedSample();
}

statisticsTests();
auxClassTests();
shutdown(0);
