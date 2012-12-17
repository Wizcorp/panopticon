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
 * The data property holds all the samples for a process. This is used to initialise and reset it
 * after an interval.
 *
 * @param {Object} thisObj The scope to operate on.
 * @private
 */

function resetData(thisObj) {
	if (thisObj.persist) {
		thisObj.emit('reset');
	} else {
		thisObj.data = {};
	}

	// After resetting the data, there may be single sets to be done for the new interval.
	thisObj.emit('newInterval');
}


/**
 * Every time a sample is taken, or thisObj.timer fires, this function checks if it is time to emit
 * a sample yet (and reset after emission), and to reset thisObj.timer if needed.
 *
 * @param {Object} thisObj The scope to operate on.
 * @private
 */

function timeUp(thisObj) {
	var now = Date.now();

	if (thisObj.endTime <= now) {
		thisObj.data.endTime = thisObj.endTime;

		// If we got left behind for some reason, catch up here.
		do {
			thisObj.endTime += thisObj.interval;
		} while (thisObj.endTime <= now);

		// Emit the sample! Emitting the interval as well allows us to distinguish between separate
		// panoptica running in parallel.
		thisObj.emit('sample', thisObj.data, thisObj.id);

		// Reset the data.
		resetData(thisObj);

		// Reset the timeout.
		if (thisObj.timer) {
			clearTimeout(thisObj.timer);
			thisObj.timer = null;
		}
	}

	// Recreate the timer if it's not running. The node.js timers have a bug which allows a timeout
	// to fire early sometimes. If that happens then the above evaluates to false, but the below
	// resets the timer, thus handling the issue. If the timer legitimately fires, then the below
	// acts to reset it.

	if (!thisObj.timer) {
		thisObj.timer = setTimeout(function () {
			thisObj.timer = null;
			timeUp(thisObj);
		}, thisObj.endTime - now);
	}
}


/**
 * Creates paths in a data sub-object. At the end of the path initialise a new Set, Int or Sample
 * object. If one already exists, update it with the new piece of data.
 *
 * @param {Object} thisObj The object that is being augmented.
 * @param {Function} DataConstructor A constructor function (Set, Inc or Sample).
 * @param {String[]} path A list of keys of increasing depth that end in the object that will receive the id/value pair.
 * @param {String} id The key in the final sub-object in the path that will receive value.
 * @param value The value to be used by the Set, Inc or Sample at the end of the path/key chain.
 * @private
 */

function augment(thisObj, DataConstructor, path, id, value) {
	var data = thisObj.data;

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

	timeUp(thisObj); // Check if this sample should be in a new set.

	// The data is a singleton. Create it if it doesn't exist, otherwise just update it.
	if (data[id]) {
		data[id].update(value);
	} else {
		data[id] = new DataConstructor(value, thisObj.persist ? thisObj : null, thisObj.logType, thisObj.scaleFactor, thisObj.interval);
	}
}


/**
 * Set up data common to the master and worker instances of Panopticon.
 *
 * @param {Object} thisObj The scope to operate on.
 * @param {Number} startTime Time in milliseconds elapsed since 1 January 1970 00:00:00 UTC.
 * @param {Number} interval Interval time in milliseconds.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz.
 * @param {Boolean} persist Are we persisting samplers on new intervals?
 * @param {Boolean} logType Are we logging type informaiton?
 * @private
 */

function genericSetup(thisObj, startTime, interval, scaleFactor, persist, logType) {
	// Create a data container
	resetData(thisObj);

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	thisObj.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;
	thisObj.scaleFactor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
	thisObj.persist = !!persist;
	thisObj.logType = !!logType;
	thisObj.id = instanceCount;

	instanceCount += 1;

	// Generate an endTime, at which we deliver the sample. If no startTime was given, we use 0.
	var now = Date.now();

	// If no start time was given, or if it was not a finite number, use zero.
	var start = Number.isFinite(startTime) ? startTime : 0;
	var offset = (start - now) % thisObj.interval;

	// If startTime is before now, we need to add an interval so that the first end time is in the
	// future. If not, we just add the offset to now.
	thisObj.endTime = now + offset + (offset < 0 ? thisObj.interval : 0);

	// Start the timer.
	thisObj.timer = null;

	// Remove limit on number of listeners.
	thisObj.setMaxListeners(0);

	timeUp(thisObj);
}


/**
 * For master only. This object will contain the aggregated data from the master and the workers.
 * This may later be extended to allow dynamic logging of cluster data.
 *
 * @param {Object} thisObj The scope to operate on.
 * @private
 */

function initAggregate(thisObj) {
	thisObj.aggregated = {
		id: thisObj.id,
		interval: thisObj.interval / thisObj.scaleFactor,
		numWorkers: new SetLog(Object.keys(cluster.workers).length, thisObj.persist, thisObj.logType),
		workers: {}
	};
}


/**
 * Sets up periodic deliveries of sample sets, and reinitialises the aggregated data object.
 *
 * @param {Object} thisObj The scope to operate on.
 * @private
 */

function setupDelivery(thisObj) {
	// Wait half an interval before beginning the delivery interval.
	var beginReporting = thisObj.endTime + thisObj.interval / 2;

	thisObj.halfInterval = setTimeout(function () {

		// Begin reporting 0.5th intervals after the first endTime. This way reports are emitted
		// well away from when batches are collected.
		thisObj.aggregationInterval = setInterval(function () {
			thisObj.emit('delivery', thisObj.aggregated);

			// Reset the aggregate object.
			initAggregate(thisObj);
		}, thisObj.interval);

	}, beginReporting);
}


/**
 * Handles sample sets emitted by itself and sent to the master by workers.
 *
 * @param {Object} thisObj The scope to operate on.
 * @private
 */

function masterSetup(thisObj) {
	// Create the basic aggregate object.
	initAggregate(thisObj);

	// Collect samples emitted by master. These are stringified and parsed because the workers went
	// through the same process. For consistency.
	thisObj.on('sample', function (data) {
		thisObj.aggregated.master = JSON.parse(JSON.stringify(data));
	});

	// Create listeners for messages from workers, both for existing workers and workers that are
	// spawned in the future.
	function setupMessageHandler(worker) {
		function onMessage(message) {
			if (message.event === 'workerSample' && message.id === thisObj.id) {
				thisObj.aggregated.workers[worker.id] = message.sample;
			}
		}

		worker.on('message', onMessage);

		// If a worker dies, release listener.
		worker.once('exit', function () {
			worker.removeListener('message', onMessage);
		});
	}

	// Collect samples emitted by existing workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		setupMessageHandler(cluster.workers[workerId]);
	});

	// If a new worker is spawned, listen to it.
	cluster.on('fork', setupMessageHandler);
}


/**
 * The workers simply send samples to the master.
 *
 * @param {Object} thisObj The scope to operate on.
 * @private
 */

function workerSetup(thisObj) {
	thisObj.on('sample', function (data, id) {
		process.send({ event: 'workerSample', sample: data, id: id });
	});
}


/**
 * The constructor for Panopticon. Handles the differences between master and worker processes.
 * Please refer to the README for more information.
 *
 * @param {Number} startTime Time in milliseconds elapsed since 1 January 1970 00:00:00 UTC.
 * @param {Number} interval Interval time in milliseconds.
 * @param {Number} [scaleFactor] 1 -> kHz, 1000 -> Hz. If no positive finite number is given, defaults to 1.
 * @param {Boolean} [persist] Keep a logger once initialised. Each interval reset it.
 * @param {Boolean} [logType] Log type information.
 * @constructor
 * @extends EventEmitter
 * @alias module:Panopticon
 */

function Panopticon(startTime, interval, scaleFactor, persist, logType) {
	EventEmitter.call(this);

	// First we sort out the methods and data which handle are local to this process.
	genericSetup(this, startTime, interval, scaleFactor, persist, logType);

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
