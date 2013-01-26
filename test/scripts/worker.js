// This is a script used by a worker process spawned for a test. It is not directly run by nodeunit,
// so it is kept in this directory to be ignored.

var Panopticon = require(__dirname + '/../../');

// Use the start time from the master process to synchronise the multiprocess panopticon.
var start = process.argv[2];

var panopticon = new Panopticon(start, 'testSet', 100, 1, true, null);

panopticon.set([], 'my name is', 'slim shady');
panopticon.inc([], 'testInc', 1);

