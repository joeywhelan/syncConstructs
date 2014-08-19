/**
 * 
 */

var timeStamper = function()
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
		
		var month = date.getMonth() + 1;
		if (month < 10)
			month = '0' + month;
			
		var mil = date.getMilliseconds();
		if (mil < 100)
			mil = '0' + mil;
		if (mil < 10)
			mil = '0' + mil;
		
		var stamp = date.getFullYear() + '-' + month + '-' + mdate + ' ' + hrs +
		':' + min + ':' + sec + '.' + mil;
		return stamp;
	};
	
	module.exports = timeStamper;