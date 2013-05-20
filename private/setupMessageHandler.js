var merge = require('./merge');


/**
 * Create listeners for messages from a worker for a panopticon instance.
 *
 * @param {Object} panopticon
 * @param {Object} worker
 * @private
 */

module.exports = function (panopticon, worker) {
	function onMessage(message) {
		if (message.event === 'workerSample' && message.id === panopticon.id) {

			// Apply transform to raw data.
			var transformed = panopticon.transform(message.sample, worker.id);

			// Merge raw data with master data
			merge(panopticon.aggregated.data, transformed);
		}
	}

	worker.on('message', onMessage);

	// If a worker dies, release listener.
	worker.once('exit', function () {
		worker.removeListener('message', onMessage);
	});
};
