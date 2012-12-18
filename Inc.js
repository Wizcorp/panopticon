/** @module Inc */

/**
 * Increment object constructor. It keeps a copy of the interval time so that it can return the
 * increments per millisecond.
 *
 * @param {Number} val Value to initialise the increment. If not a finite number, defaults to 1.
 * @param {Number} timeStamp A unix time stamp (in ms).
 * @param {Object} persistObj Object that emits a reset event. An instance of inc belongs to this object.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz.
 * @param {Number} interval This interval over which increments are to be taken.
 * @constructor
 * @alias module:Inc
 */

function Inc(val, timeStamp, persistObj, scaleFactor, interval) {
	this.value = Number.isFinite(val) ? val : 1;
	this.interval = interval;
	this.scaleFactor = scaleFactor;
	this.timeStamp = timeStamp;

	if (persistObj) {
		var that = this;

		persistObj.on('reset', function (timeStamp) {
			that.reset(timeStamp);
		});
	}
}


/**
 * Update the increment. If given no argument it defaults to adding one.
 *
 * @param {Number} val Increment by val, or 1 if val is not a finite number.
 */

Inc.prototype.update = function (val, timeStamp) {
	this.value += Number.isFinite(val) ? val : 1;
	this.timeStamp = timeStamp;
};


/**
 * We do the conversion of increments per interval to increments per millisecond upon serialisation.
 *
 * @return {Number} Divides the internal state of the increment by the intervat and yields.
 */

Inc.prototype.toJSON = function () {
	return {
		type: 'inc',
		value: { val: this.scaleFactor * this.value / this.interval, timeStamp: this.timeStamp }
	};
};


/**
 * If we are persisting, set this back to zero.
 */

Inc.prototype.reset = function (timeStamp) {
	this.value = 0;
	this.timeStamp = timeStamp;
};


module.exports = Inc;