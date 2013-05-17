/**
 * The data property holds all the samples for a process. This is used to initialise and reset it
 * after an interval.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

module.exports = function (panopticon) {
	if (panopticon.persist) {
		panopticon.emit('reset', panopticon.endTime);
	} else {
		panopticon.data = {};
	}

	// After resetting the data, there may be single sets to be done for the new interval.
	panopticon.emit('newInterval');
};
