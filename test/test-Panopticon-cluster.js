var cluster = require('cluster');
var Panopticon = require(__dirname + '/../');

cluster.setupMaster({
	exec: __dirname + '/scripts/worker.js',
	args: [],
	silent: false
});


exports['try cluster'] = function (test) {
	test.expect(1);

	var worker = cluster.fork();
	var panopticon = new Panopticon(Date.now(), 'testSet', 100, 1, true, null);
	console.log(panopticon.id);
	var count = 0;

	panopticon.on('delivery', function (data) {
		if (count !== 1) {
			count++;
			return;
		}

		console.log(data);
		worker.send('shutdown');
		worker.destroy();
	});

	cluster.on('disconnect', function () {
		panopticon.stop();

		test.ok(true);
		test.done();
	});
};
