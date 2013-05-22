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

// Registered methods.
var registeredMethods = [];

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
	var isInstance = this instanceof Panopticon;

	if (!isInstance) {
		return new Panopticon(startTime, name, interval, scaleFactor, persist, transformer);
	}

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
 * Class method to allow new loggers to be registered.
 *
 * @param {String}   name        Name of the logger method.
 * @param {Function} loggerClass A constructor function that conforms to the panopticon logger API.
 * @param {Function} [validator] A function that screens datapoints. It must return true for valid.
 */

Panopticon.registerMethod = function (name, loggerClass, validator) {
	if (registeredMethods.indexOf(name) !== -1) {
		throw new Error('Method "' + name + '" is already registered.');
	}

	if (Panopticon.prototype.hasOwnProperty(name)) {
		throw new Error('Method "' + name + '" is already a panopticon prototype property.');
	}

	if (typeof loggerClass !== 'function') {
		throw new Error('loggerClass must be a constructor function.');
	}

	registeredMethods.push(name);

	Panopticon.prototype[name] = function (path, id, dataPoint) {
		if (!validator || validator(dataPoint)) {
			augment(this, loggerClass, path, id, dataPoint);
		}
	};
};

// Register built in logger methods.
Panopticon.registerMethod('sample', SampleLog, Number.isFinite);
Panopticon.registerMethod('timedSample', TimedSampleLog, Array.isArray);
Panopticon.registerMethod('inc', IncLog);
Panopticon.registerMethod('set', SetLog);


/**
 * Static method that returns a copy of the internal array of registered method names.
 *
 * @return {Array} A list of registered panopticon methods.
 */

Panopticon.getLoggerMethodNames = function () {
	return registeredMethods.slice();
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
