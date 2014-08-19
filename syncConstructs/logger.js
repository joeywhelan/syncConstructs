var logger = require('winston');
var properties = require('./properties');

var timestamper = function()
	{
		var date = new Date();
		var sec = date.getSeconds();
		if (sec < 10)
			sec = '0' + sec;
		
		var min = date.getMinutes();
		if (min < 10)
			min = '0' + min;
		
		var hrs = date.getHours();
		if (hrs < 10)
			hrs = '0' + hrs;
		
		var mdate = date.getDate();
		if (mdate < 10)
			mdate = '0' + mdate;
		
		var mil = date.getMilliseconds()
		if (mil < 100)
			mil = '0' + mil;
		if (mil < 10)
			mil = '0' + mil;
		
		var stamp = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + mdate + ' ' + hrs +
		':' + min + ':' + sec + "." + mil;
		return stamp;
	};
	
logger.add(logger.transports.File, 
		{	level: properties.logLevel,
			filename: properties.logFile, 
			json: false, 
			timestamp: timestamper,
			maxsize: properties.logSize,
			maxFiles: properties.maxLogFiles,
			handleExceptions: true
		});


logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, 
		{
			level: properties.logLevel,
			timestamp: timestamper,
			handleExceptions: true
		});

logger.exitOnError = false;



module.exports = logger;