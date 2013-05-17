var resetData = require('./resetData');


/**
 * Every time a sample is taken, or panopticon.timer fires, this function checks if it is time to emit
 * a sample yet (and reset after emission), and to reset panopticon.timer if needed.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

module.exports = function timeUp(panopticon) {
	var now = Date.now();
	var shouldEmit = false;

	if (panopticon.endTime <= now) {

		// If we got left behind for some reason, catch up here.
		do {
			panopticon.endTime += panopticon.interval;
		} while (panopticon.endTime <= now);

		shouldEmit = true; // Use this to tell us if we should be emitting a sample or not.

		// Reset the timeout.
		if (panopticon.timer) {
			clearTimeout(panopticon.timer);
			panopticon.timer = null;
		}
	}

	// Recreate the timer if it's not running. The node.js timers have a bug which allows a timeout
	// to fire early sometimes. If that happens then the above evaluates to false, but the below
	// resets the timer, thus handling the issue. If the timer legitimately fires, then the below
	// acts to reset it.
	if (!panopticon.timer) {
		panopticon.timer = setTimeout(function () {
			panopticon.timer = null;
			timeUp(panopticon);
		}, panopticon.endTime - now);
	}

	// If the interval was really over, we do this. It's down here because this allows up to stop
	// clear panopticon.timer on 'sample' without the timer getting restarted.
	if (shouldEmit) {

		// Emit the sample! Emitting the interval as well allows us to distinguish between separate
		// panoptica running in parallel.
		panopticon.emit('sample', panopticon.data, panopticon.id);

		// Reset the data.
		resetData(panopticon);
	}
};
