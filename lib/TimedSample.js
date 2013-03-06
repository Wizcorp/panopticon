/** @module TimedSample */
var Average = require('./Average');
var StandardDeviation = require('./StandardDeviation');

/**
 * Timed sample object constructor.
 *
 * @param {Number[]} dt Takes the output of a diff produced by feeding the result of one hrtime as the parameter to another.
 * @param {Number} timeStamp A unix time stamp (in ms).
 * @param {Object} persistObj Emits reset events. An instance of timed sample belongs to this object.
 * @param {Number} scaleFactor The scale factor for time calculations. 1 -> 1kHz, 1000 -> 1Hz.
 * @constructor
 * @alias module:TimedSample
 */

function TimedSample(dt, timeStamp, persistObj, scaleFactor) {
	var time = (dt[0] + dt[1] / 1e9) * 1000 / scaleFactor;

	this.scaleFactor = scaleFactor;
	this.min = time;
	this.max = time;
	this.sigma = new StandardDeviation(time);
	this.average = new Average(time);
	this.timeStamp = timeStamp;

	if (persistObj) {
		var that = this;

		persistObj.on('reset', function (timeStamp) {
			that.reset(timeStamp);
		});
	}
}


/**
 * Add a time sample.
 *
 * @param  {Number[]} dt Add an hrtime difference sample.
 */

TimedSample.prototype.update = function (dt, timeStamp) {
	var time = (dt[0] + dt[1] / 1e9) * 1000 / this.scaleFactor;
	this.min = Number.isFinite(this.min) ? Math.min(this.min, time) : time;
	this.max = Number.isFinite(this.max) ? Math.max(this.max, time) : time;
	this.timeStamp = timeStamp;

	if (!this.sigma) {
		this.sigma = new StandardDeviation(time);
	} else {
		this.sigma.addMeasurement(time);
	}

	if (!this.average) {
		this.average = new Average(time);
	} else {
		this.average.addMeasurement(time);
	}
};


/**
 * If we are persisting, then this is used to put the TimedSample back into an uninitialised state.
 *
 * @param {Number} timeStamp A unix time stamp (in ms).
 */

TimedSample.prototype.reset = function (timeStamp) {
	this.min = null;
	this.max = null;
	this.sigma = null;
	this.average = null;
	this.timeStamp = timeStamp;
};


/**
 * Returns the content of this without the scaleFactor included.
 *
 * @return {Object}
 */

TimedSample.prototype.toJSON = function () {
	return {
		type: 'timedSample',
		value: {
			min: this.min,
			max: this.max,
			sigma: this.sigma,
			average: this.average,
			scaleFactor: this.scaleFactor,
			timeStamp: this.timeStamp
		}
	};
};


module.exports = TimedSample;