/**
 * The default transformer function. If none is provided upon panopticon instantiation then this is
 * used.
 *
 * @param {Object} data An object containing data.
 * @param {String|Number} id Worker id or 'master' for the master process.
 * @return {Object} Transformed data.
 * @private
 */

module.exports = function (data, id) {
	if (id === 'master') {
		return { master: data };
	}

	var toReturn = { workers: {} };
	toReturn.workers[id] = data;

	return toReturn;
};
