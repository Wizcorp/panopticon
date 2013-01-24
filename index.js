/** @module Panopticon */
var EventEmitter   = require('events').EventEmitter;
var cluster        = require('cluster');
var util           = require('util');
var SetLog         = require('./Set');
var IncLog         = require('./Inc');
var SampleLog      = require('./Sample');
var TimedSampleLog = require('./TimedSample');

// id gets incremented with each new panopticon. This allows us to have multiple panoptica running
// in parallel without master panoptica getting messages from multiple panoptica on each worker.
var instanceCount = 0;

/**
 * Merge a supplemental document with a master document. This assumes that both follow the same
 * schema, but with elements possibly not represented.
 *
 * @param master
 * @param supplement
 * @private
 */

function merge(master, supplement) {
	if (typeof supplement !== 'object') {
		return;
	}

	for (var key in supplement) {
		if (supplement.hasOwnProperty(key)) {
			if (master.hasOwnProperty(key)) {
				merge(master[key], supplement[key]);
			} else {
				master[key] = supplement[key];
			}
		}
	}
}


/**
 * The default transformer function. If none is provided upon panopticon instantiation then this is
 * used.
 *
 * @param {Object} data An object containing data.
 * @param {String|Number} id Worker id or 'master' for the master process.
 * @return {Object} Transformed data.
 * @private
 */

function defaultTransformer(data, id) {
	if (id === 'master') {
		return { master: data };
	}

	var toReturn = { workers: {} };
	toReturn.workers[id] = data;

	return toReturn;
}


/**
 * The data property holds all the samples for a process. This is used to initialise and reset it
 * after an interval.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

function resetData(panopticon) {
	if (panopticon.persist) {
		panopticon.emit('reset', panopticon.endTime);
	} else {
		panopticon.data = {};
	}

	// After resetting the data, there may be single sets to be done for the new interval.
	panopticon.emit('newInterval');
}


/**
 * Every time a sample is taken, or panopticon.timer fires, this function checks if it is time to emit
 * a sample yet (and reset after emission), and to reset panopticon.timer if needed.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

function timeUp(panopticon) {
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
}


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

function augment(panopticon, DataConstructor, path, id, value) {
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
}


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

function genericSetup(panopticon, name, startTime, interval, scaleFactor, persist, transformer) {
	// Create a data container
	resetData(panopticon);

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	panopticon.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;
	panopticon.scaleFactor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
	panopticon.persist = !!persist;
	panopticon.transform = transformer || defaultTransformer;
	panopticon.id = instanceCount;
	panopticon.name = name;

	instanceCount += 1;

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
}


/**
 * For master only. This object will contain the aggregated data from the master and the workers.
 * This may later be extended to allow dynamic logging of cluster data.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

function initAggregate(panopticon) {
	panopticon.aggregated = {
		id: panopticon.id,
		name: panopticon.name,
		interval: panopticon.interval / panopticon.scaleFactor,
		data: {}
	};
}


/**
 * Sets up periodic deliveries of sample sets, and reinitialises the aggregated data object.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

function setupDelivery(panopticon) {
	// Wait half an interval before beginning the delivery interval.
	var beginReporting = panopticon.endTime + panopticon.interval / 2;

	panopticon.halfInterval = setTimeout(function () {

		// Begin reporting 0.5th intervals after the first endTime. This way reports are emitted
		// well away from when batches are collected.
		panopticon.aggregationInterval = setInterval(function () {
			panopticon.emit('delivery', panopticon.aggregated);

			// Reset the aggregate object.
			initAggregate(panopticon);
		}, panopticon.interval);

	}, beginReporting);
}


/**
 * Create listeners for messages from a worker for a panopticon instance.
 *
 * @param {object} panopticon
 * @param {object} worker
 */

function setupMessageHandler(panopticon, worker) {
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
}


/**
 * Handles sample sets emitted by itself and sent to the master by workers.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

function masterSetup(panopticon) {
	// Create the basic aggregate object.
	initAggregate(panopticon);

	// Collect samples emitted by master. These are stringified and parsed because the workers went
	// through the same process. For consistency.
	panopticon.on('sample', function (data) {

		// Apply transform to master data. This must be JSON stringified and parsed to make sure
		// that `value` (which may be generated by a `toJSON` function has been created for each
		// datum.
		var transformed = panopticon.transform(JSON.parse(JSON.stringify(data)), 'master');

		// Merge transformed data with the aggregate.
		merge(panopticon.aggregated.data, transformed);
	});

	// This closure allows us to unregister this listener when this panopticon shuts down.
	var messageHandler = function (worker) {
		setupMessageHandler(panopticon, worker);
	};

	// Collect samples emitted by existing workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		messageHandler(cluster.workers[workerId]);
	});

	// If a new worker is spawned, listen to it.
	cluster.on('fork', messageHandler);

	// If the panopticon is stopped, we should remove the listener.
	panopticon.once('stopping', function () {
		cluster.removeListener('fork', messageHandler);
	});
}


/**
 * The workers simply send samples to the master.
 *
 * @param {Object} panopticon The scope to operate on.
 * @private
 */

function workerSetup(panopticon) {
	panopticon.on('sample', function (data, id) {
		process.send({ event: 'workerSample', sample: data, id: id });
	});
}


/**
 * The constructor for Panopticon. Handles the differences between master and worker processes.
 * Please refer to the README for more information.
 *
 * @param {Number} startTime Time in milliseconds elapsed since 1 January 1970 00:00:00 UTC.
 * @param {String} name The name of the panopticon being constructed.
 * @param {Number} interval Interval time in milliseconds.
 * @param {Number} [scaleFactor] 1 -> kHz, 1000 -> Hz. If no positive finite number is given, defaults to 1.
 * @param {Boolean} [persist] Keep a logger once initialised. Each interval reset it.
 * @param {Function} [transformer] A custom function to transform data before merging with the aggregate.
 * @constructor
 * @extends EventEmitter
 * @alias module:Panopticon
 */

function Panopticon(startTime, name, interval, scaleFactor, persist, transformer) {
	EventEmitter.call(this);

	// First we sort out the methods and data which handle are local to this process.
	genericSetup(this, name, startTime, interval, scaleFactor, persist, transformer);

	// If the process is a worker, we only need to send the master results then return. If the
	// process is not a worker, it is either the master or stand alone. The master also handles
	// the delivery of aggregated data.
	if (cluster.isWorker) {
		workerSetup(this);
	} else {
		masterSetup(this);
		setupDelivery(this);
	}
}

util.inherits(Panopticon, EventEmitter);


/**
 * Take a sample for which the min, max, average and standard deviation are relevant and calculate
 * these before insertion into the workerData object.
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to within the address defined by path.
 * @param {Number} n The number to sample.
 */

Panopticon.prototype.sample = function (path, id, n) {
	if (!Number.isFinite(n)) {
		return;
	}

	augment(this, SampleLog, path, id, n);
};


/**
 * Use the Δt array representing the difference between two readings process.hrtime():
 * var diff = process.hrtime(start);
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to within the address defined by path.
 * @param {Number[]} dt Output from process.hrtime().
 */

Panopticon.prototype.timedSample = function (path, id, dt) {
	if (!Array.isArray(dt)) {
		return;
	}

	augment(this, TimedSampleLog, path, id, dt);
};


/**
 * Take a counter and increment by n if given or 1. Set up the counter if it does not already exist
 * as a field in the workerData object.
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to within the address defined by path.
 * @param {Number} n Increment the addressed data by n. If this is the initial increment, treat the addressed data as 0.
 */

Panopticon.prototype.inc = function (path, id, n) {
	augment(this, IncLog, path, id, n);
};


/**
 * Create or overwrite a field in the workerData object.
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to.
 * @param n Data to set. This is not restricted to numbers.
 */

Panopticon.prototype.set = function (path, id, n) {
	augment(this, SetLog, path, id, n);
};


/**
 * Clears the interval and the timeout. Removes listeners on a panopticon.
 */

Panopticon.prototype.stop = function () {
	this.emit('stopping'); // This is used to remove the cluster.fork listener on master.

	this.removeAllListeners();

	clearTimeout(this.halfInterval);
	this.halfInterval = null;

	clearInterval(this.aggregationInterval);
	this.aggregationInterval = null;

	clearTimeout(this.timer);
	this.timer = null;
};


/**
 * Static method returns the number of panoptica instances.
 *
 * @return {Number}
 */

Panopticon.count = function () {
	return instanceCount;
};


// This is a constructor-module, so the only thing on module.exports is the constructor itself.
module.exports = Panopticon;
