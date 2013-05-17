/**
 * The workers simply send samples to the master.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

module.exports = function (panopticon) {
	panopticon.on('sample', function (data, id) {
		process.send({ event: 'workerSample', sample: data, id: id });
	});
};
