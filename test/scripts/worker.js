var Panopticon = require(__dirname + '/../../');

var panopticon = new Panopticon(Date.now(), 'testSet', 50, 1, true, null);

panopticon.set([], 'my name is', 'slim shady');
panopticon.inc(['somepath'], 'increment', 10);
console.log(panopticon.id);

process.on('message', function (message) {
	if (message === 'shutdown') {
		panopticon.stop();
		process.exit();
	}
});
