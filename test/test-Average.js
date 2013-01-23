var Average = require(__dirname + '/../Average');

function seDes(obj) {
	return JSON.parse(JSON.stringify(obj));
}

exports['expected output after JSON parsing'] = function (test) {
	test.expect(1);

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

	test.strictEqual(actual, expected);
	test.done();
};