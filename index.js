/**
 * @module Panopticon
 * @author Mark S. Everitt
 */
var EventEmitter   = require('events').EventEmitter;
var cluster        = require('cluster');
var util           = require('util');

// Panopticon data types.
var SetLog         = require('./lib/Set');
var IncLog         = require('./lib/Inc');
var SampleLog      = require('./lib/Sample');
var TimedSampleLog = require('./lib/TimedSample');

// id gets incremented with each new panopticon. This allows us to have multiple panoptica running
// in parallel without master panoptica getting messages from multiple panoptica on each worker.
var instanceCount = 0;

// Load the private methods.
var augment       = require('./private/augment');
var genericSetup  = require('./private/genericSetup');
var setupDelivery = require('./private/setupDelivery');
var masterSetup   = require('./private/masterSetup');
var workerSetup   = require('./private/workerSetup');


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
	this.id = instanceCount;
	instanceCount += 1;

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

/**
 * Used for unit testing to reset the panopticon count. DO NOT USE.
 *
 * @private
 */

Panopticon._resetCount = function () {
	instanceCount = 0;
};


// This is a constructor-module, so the only thing on module.exports is the constructor itself.
module.exports = Panopticon;
