/**
 * Merge a supplemental document with a master document. This assumes that both follow the same
 * schema, but with elements possibly not represented.
 *
 * @param master
 * @param supplement
 * @private
 */

module.exports = function merge(master, supplement) {
	if (typeof supplement !== 'object' || supplement === null) {
		return;
	}

	var keys = Object.keys(supplement);

	for (var i = 0, len = keys.length; i < len; i += 1) {
		var key = keys[i];

		if (master.hasOwnProperty(key)) {
			merge(master[key], supplement[key]);
		} else {
			master[key] = supplement[key];
		}
	}
};
