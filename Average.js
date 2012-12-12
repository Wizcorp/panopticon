/** @module Average */

/**
 * In line with the standard deviation object, this is a very simple averaging object.
 *
 * @param {Number} firstMeasurement The initial measurement.
 * @constructor
 * @alias module:Average
 */
function Average(firstMeasurement) {
	this.total = firstMeasurement;
	this.count = 1;
}


/**
 * Add a measurement. Increments the counter and updates the total.
 *
 * @param measurement A measurement to add to the set to be averaged.
 */
Average.prototype.addMeasurement = function (measurement) {
	this.count += 1;
	this.total += measurement;
};


/**
 * Simply divides the total by the number of measurements taken and returns the result.
 *
 * @return {Number} Divides the stored total and the stored count to yield the average.
 */
Average.prototype.toJSON = function () {
	return this.total / this.count;
};


module.exports = Average;