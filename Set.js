/** @module Set */

/**
 * This Set constructor exists mainly to unify the interface with Sample and Inc. The value is not
 * limited to numbers.
 *
 * @param val Simply sets the internal state to val.
 * @param {Number} timeStamp A unix time stamp (in ms).
 * @param {Object} persistObj The object that this set belongs to. This is not used, but the argument must be here for consistency.
 * @constructor
 * @alias module:Set
 */

function Set(val, timeStamp, persistObj) {
	this.value = val;
	this.timeStamp = timeStamp;

	if (persistObj) {
		var that = this;

		persistObj.on('reset', function (timeStamp) {
			that.reset(timeStamp);
		});
	}
}


/**
 * Simply replace the existing value contained in a set object.
 *
 * @param val Reset the internal state to val.
 * @param {Number} timeStamp A unix time stamp (in ms).
 */

Set.prototype.update = function (val, timeStamp) {
	this.value = val;
	this.timeStamp = timeStamp;
};


/**
 * Simply return the value in the value contained in a set object.
 *
 * @return Returns the stored value, with optional type information.
 */

Set.prototype.toJSON = function () {
	return {
		type: 'set',
		value: { val: this.value, timeStamp: this.timeStamp}
	};
};


/**
 * If we are persisting, set the time stamp.
 *
 * @param {Number} timeStamp A unix time stamp (in ms).
 */

Set.prototype.reset = function (timeStamp) {
	this.timeStamp = timeStamp;
};


module.exports = Set;