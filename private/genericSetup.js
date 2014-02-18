var resetData = require('./resetData');
var defaultTransformer = require('./defaultTransformer');
var timeUp = require('./timeUp');


/**
 * Set up data common to the master and worker instances of Panopticon.
 *
 * @param {Object}   panopticon The scope to operate on.
 * @param {Object}   options               The configuration object.
 * @param {Number}   options.startTime     Time in ms elapsed since 1 January 1970 00:00:00 UTC.
 * @param {String}   options.name          The name of the panopticon being constructed.
 * @param {Number}   options.interval      Interval time in milliseconds.
 * @param {Number}   [options.scaleFactor] 1 -> kHz, 1000 -> Hz. If no positive finite number is
 *                                         given, defaults to 1.
 * @param {Boolean}  [options.persist]     Keep a logger once initialized. Each interval reset it.
 * @param {Function} [options.transformer] A custom function to transform data before merging with
 *                                         the aggregate.

 * @private
 */

module.exports = function (panopticon, options) {
	// Create a data container
	resetData(panopticon);

	var interval = options.interval;
	var scaleFactor = options.scaleFactor;

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	panopticon.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;
	panopticon.scaleFactor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
	panopticon.persist = !!options.persist;
	panopticon.transform = options.transformer || defaultTransformer;
	panopticon.name = options.name;


	// Generate an endTime, at which we deliver the sample. If no startTime was given, we use 0.
	var now = Date.now();

	// If no start time was given, or if it was not a finite number, use zero.
	var start = Number.isFinite(options.startTime) ? options.startTime : 0;
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
