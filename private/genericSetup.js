var resetData = require('./resetData');
var defaultTransformer = require('./defaultTransformer');
var timeUp = require('./timeUp');


/**
 * Set up data common to the master and worker instances of Panopticon.
 *
 * @param {Object} panopticon The scope to operate on.
 * @param {Number} startTime Time in milliseconds elapsed since 1 January 1970 00:00:00 UTC.
 * @param {Number} interval Interval time in milliseconds.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz.
 * @param {Boolean} persist Are we persisting samplers on new intervals?
 * @param {Function} [transformer] A custom transformer function.
 * @private
 */

module.exports = function (panopticon, name, startTime, interval, scaleFactor, persist, transformer) {
	// Create a data container
	resetData(panopticon);

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	panopticon.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;
	panopticon.scaleFactor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
	panopticon.persist = !!persist;
	panopticon.transform = transformer || defaultTransformer;
	panopticon.name = name;


	// Generate an endTime, at which we deliver the sample. If no startTime was given, we use 0.
	var now = Date.now();

	// If no start time was given, or if it was not a finite number, use zero.
	var start = Number.isFinite(startTime) ? startTime : 0;
	var offset = (start - now) % panopticon.interval;

	// If startTime is before now, we need to add an interval so that the first end time is in the
	// future. If not, we just add the offset to now.
	panopticon.endTime = now + offset + (offset < 0 ? panopticon.interval : 0);

	// Start the timer.
	panopticon.timer = null;

	// Remove limit on number of listeners.
	panopticon.setMaxListeners(0);

	timeUp(panopticon);
};
