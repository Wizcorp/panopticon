/** @module Sample */
var Average = require('./Average');
var StandardDeviation = require('./StandardDeviation');

/**
 * Sample taker object constructor.
 *
 * @param {Number} val This first value is used to initialise the sample.
 * @param {Object} persistObj If we are persisting then we don't initialise.
 * @param {Boolean} logType Log type information.
 * @constructor
 * @alias module:Sample
 */
function Sample(val, persistObj, logType) {
	this.min = val;
	this.max = val;
	this.sigma = new StandardDeviation(val);
	this.average = new Average(val);
	this.logType = logType;

	if (persistObj) {
		var that = this;

		persistObj.on('reset', function () {
			that.reset();
		});
	}
}


/**
 * Add a sample.
 *
 * @param {Number} val Update the sample set.
 */
Sample.prototype.update = function (val) {
	this.min = this.hasOwnProperty('min') ? Math.min(this.min, val) : val;
	this.max = this.hasOwnProperty('max') ? Math.max(this.max, val) : val;

	if (!this.sigma) {
		this.sigma = new StandardDeviation(val);
	} else {
		this.sigma.addMeasurement(val);
	}

	if (!this.average) {
		this.average = new Average(val);
	} else {
		this.average.addMeasurement(val);
	}
};


/**
 * When we have a persistent function, reset is called at the end of an interval;
 */
Sample.prototype.reset = function () {
	this.min = null;
	this.max = null;
	this.sigma = null;
	this.average = null;
};


/**
 * Process the result for stringification.
 *
 * @return {Object}
 */
Sample.prototype.toJSON = function () {
	var toReturn = {
		max: this.max,
		min: this.min,
		sigma: this.sigma,
		average: this.average
	};

	return this.logType ? { type: 'sample', value: toReturn } : toReturn;
};


module.exports = Sample;