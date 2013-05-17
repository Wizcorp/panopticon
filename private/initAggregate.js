/**
 * For master only. This object will contain the aggregated data from the master and the workers.
 * This may later be extended to allow dynamic logging of cluster data.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

module.exports = function (panopticon) {
	panopticon.aggregated = {
		id: panopticon.id,
		name: panopticon.name,
		interval: panopticon.interval / panopticon.scaleFactor,
		data: {}
	};
};
