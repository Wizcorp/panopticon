var StandardDeviation = require(__dirname + '/../StandardDeviation');

function seDes(obj) {
	return JSON.parse(JSON.stringify(obj));
}

exports['standard deviation cannot be calculated for a single sample'] = function (test) {
	test.expect(1);

	var standardDeviation = new StandardDeviation(1);
	var actual = seDes(standardDeviation);

	// Standard deviation cannot be calculated for a single sample.
	test.strictEqual(actual, null);
	test.done();
};

exports['for two samples standard deviation is defined'] = function (test) {
	test.expect(1);

	var standardDeviation = new StandardDeviation(1);
	standardDeviation.addMeasurement(1);
	var actual = seDes(standardDeviation);

	test.strictEqual(actual, 0);
	test.done();
};

exports['algorithm should be verified against another implementation'] = function (test) {
	test.expect(3);

	// The algorithm here is a raw version of the one found in the module. It's written as
	// closely to the algorithm as possible.
	var sampleList = [10, 100, 1000];

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

	// Test for different sample set sizes.
	sampleList.forEach(function (samples) {
		var testArray = [];

		for (var i = 0; i < samples; i += 1) {
			testArray.push(Math.random() * 100 - 50);
		}

		var expected = sigma(testArray);

		var standardDeviation = new StandardDeviation(testArray.shift());

		testArray.forEach(function (sample) {
			standardDeviation.addMeasurement(sample);
		});

		var actual = seDes(standardDeviation);

		test.strictEqual(actual, expected);
	});

	test.done();
};