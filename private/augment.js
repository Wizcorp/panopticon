var timeUp = require('./timeUp');


/**
 * Creates paths in a data sub-object. At the end of the path initialise a new Set, Int or Sample
 * object. If one already exists, update it with the new piece of data.
 *
 * @param {Object} panopticon The object that is being augmented.
 * @param {Function} DataConstructor A constructor function (Set, Inc or Sample).
 * @param {String[]} path A list of keys of increasing depth that end in the object that will receive the id/value pair.
 * @param {String} id The key in the final sub-object in the path that will receive value.
 * @param value The value to be used by the Set, Inc or Sample at the end of the path/key chain.
 * @private
 */

module.exports = function (panopticon, DataConstructor, path, id, value) {
	var data = panopticon.data;

	if (path) {
		var i, len = path.length;

		for (i = 0; i < len; i += 1) {
			var step = path[i];

			if (!data.hasOwnProperty(step)) {
				data[step] = {};
			}

			data = data[step];
		}
	}

	timeUp(panopticon); // Check if this sample should be in a new set.

	// The data is a singleton. Create it if it doesn't exist, otherwise just update it.
	if (data[id]) {
		data[id].update(value, panopticon.endTime);
	} else {
		data[id] = new DataConstructor(value, panopticon.endTime, panopticon.persist ? panopticon : null, panopticon.scaleFactor, panopticon.interval);
	}
};
