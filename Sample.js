/** @module Sample */
var Average = require('./Average');
var StandardDeviation = require('./StandardDeviation');

/**
 * Sample taker object constructor.
 *
 * @param {Number} val This first value is used to initialise the sample.
 * @param {Number} timeStamp A unix time stamp (in ms).
 * @param {Object} persistObj If we are persisting then we don't initialise.
 * @constructor
 * @alias module:Sample
 */

function Sample(val, timeStamp, persistObj) {
	this.min = val;
	this.max = val;
	this.sigma = new StandardDeviation(val);
	this.average = new Average(val);
	this.timeStamp = timeStamp;

	if (persistObj) {
		var that = this;

		persistObj.on('reset', function (timeStamp) {
			that.reset(timeStamp);
		});
	}
}


/**
 * Add a sample.
 *
 * @param {Number} val Update the sample set.
 */

Sample.prototype.update = function (val, timeStamp) {
	this.min = this.min === null ? val : Math.min(this.min, val);
	this.max = this.max === null ? val : Math.max(this.max, val);
	this.timeStamp = timeStamp;

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
 *
 * @param {Number} timeStamp A unix time stamp (in ms).
 */

Sample.prototype.reset = function (timeStamp) {
	this.min = null;
	this.max = null;
	this.sigma = null;
	this.average = null;
	this.timeStamp = timeStamp;
};


/**
 * Process the result for stringification.
 *
 * @return {Object}
 */

Sample.prototype.toJSON = function () {
	return {
		type: 'sample',
		value: {
			max: this.max,
			min: this.min,
			sigma: this.sigma,
			average: this.average,
			timeStamp: this.timeStamp
		}
	};
};


module.exports = Sample;