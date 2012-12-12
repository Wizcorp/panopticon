/** @module StandardDeviation */

/**
 * A standard deviation object constructor. Running deviation (avoid growing arrays) which is
 * round-off error resistant.
 *
 * @param {Number} firstMeasurement The first measurement is used to initialise the set.
 * @constructor
 * @alias module:StandardDeviation
 */
function StandardDeviation(firstMeasurement) {
	this.count = 1;
	this.mean = firstMeasurement;
	this.S = 0;
}


/**
 * Add a measurement. Also calculates updates to stepwise parameters which are later used to
 * determine sigma.
 *
 * @param {Number} measurement Add a measurement to the set to calculate a standard deviation of.
 */
StandardDeviation.prototype.addMeasurement = function (measurement) {
	var delta = measurement - this.mean;

	this.count += 1;
	this.mean += delta / this.count;
	this.S += delta * (measurement - this.mean);
};


/**
 * Performs the final step needed to get the standard deviation and returns it.
 *
 * @return {Number} Performs the final step needed to yield an estimate of the standard deviation.
 */
StandardDeviation.prototype.toJSON = function () {
	return Math.sqrt(this.S / (this.count - 1));
};


module.exports = StandardDeviation;