var initAggregate = require('./initAggregate');


/**
 * Sets up periodic deliveries of sample sets, and reinitialises the aggregated data object.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

module.exports = function (panopticon) {
	// Wait half an interval before beginning the delivery interval.
	var beginReporting = panopticon.endTime - Date.now() - panopticon.interval / 2;

	panopticon.halfInterval = setTimeout(function () {

		// Begin reporting 0.5th intervals after the first endTime. This way reports are emitted
		// well away from when batches are collected.
		panopticon.aggregationInterval = setInterval(function () {
			panopticon.emit('delivery', panopticon.aggregated);

			// Reset the aggregate object.
			initAggregate(panopticon);
		}, panopticon.interval);

	}, beginReporting);
};
