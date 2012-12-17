/** @module Set */

/**
 * This Set constructor exists mainly to unify the interface with Sample and Inc. The value is not
 * limited to numbers.
 *
 * @param val Simply sets the internal state to val.
 * @param {Object} persistObj The object that this set belongs to. This is not used, but the argument must be here for consistency.
 * @param {Boolean} logType Log type information.
 * @constructor
 * @alias module:Set
 */

function Set(val, persistObj, logType) {
	this.logType = logType;
	this.value = val;
}


/**
 * Simply replace the existing value contained in a set object.
 *
 * @param val Reset the internal state to val.
 */

Set.prototype.update = function (val) {
	this.value = val;
};


/**
 * Simply return the value in the value contained in a set object.
 *
 * @return Returns the stored value, with optional type information.
 */

Set.prototype.toJSON = function () {
	return this.logType ? { type: 'set', value: this.value } : this.value;
};


module.exports = Set;