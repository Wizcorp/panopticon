/** @module Inc */

/**
 * Increment object constructor. It keeps a copy of the interval time so that it can return the
 * increments per millisecond.
 *
 * @param {Number} val Value to initialise the increment. If not a finite number, defaults to 1.
 * @param {Object} persistObj Object that emits a reset event. An instance of inc belongs to this object.
 * @param {Boolean} logType Boolean that indicates if we want to log type information.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz.
 * @param {Number} interval This interval over which increments are to be taken.
 * @constructor
 * @alias module:Inc
 */

function Inc(val, persistObj, logType, scaleFactor, interval) {
	this.value = Number.isFinite(val) ? val : 1;
	this.interval = interval;
	this.scaleFactor = scaleFactor;
	this.logType = logType;

	if (persistObj) {
		var that = this;

		persistObj.on('reset', function () {
			that.reset();
		});
	}
}


/**
 * Update the increment. If given no argument it defaults to adding one.
 *
 * @param {Number} val Increment by val, or 1 if val is not a finite number.
 */

Inc.prototype.update = function (val) {
	this.value += Number.isFinite(val) ? val : 1;
};


/**
 * We do the conversion of increments per interval to increments per millisecond upon serialisation.
 *
 * @return {Number} Divides the internal state of the increment by the intervat and yields.
 */

Inc.prototype.toJSON = function () {
	var toReturn = this.scaleFactor * this.value / this.interval;

	return this.logType ? { type: 'inc', value: toReturn } : toReturn;
};


/**
 * If we are persisting, set this back to zero.
 */

Inc.prototype.reset = function () {
	this.value = 0;
};


module.exports = Inc;