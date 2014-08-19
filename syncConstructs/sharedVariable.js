/*
 * Author:  Joey Whelan
 * Shared memory object utilizing Redis.
*/

var redis = require('redis');
var logger = require('./logger');
var properties = require('./properties');

/*
 * Constructor
 * 
 * key - string representing the name of the object. 
 * 
 */
function sharedVariable(key)
{
    logger.debug('Entering - File: sharedVariable.js, Method: sharedVariable, key: %s, process id: %d', key, process.pid);
    this.key = key;
    this.client = redis.createClient(properties.redisServer.port, properties.redisServer.host);  //redis command client
    logger.debug('Exiting - File: sharedVariable.js, Method: sharedVariable');
};

/*
 * Async fetch method.
 * 
 * callback - invoked upon completion of fetch
 */
sharedVariable.prototype.get = function(callback)
{
    logger.debug('Entering - File: sharedVariable.js, Method: get, key: %s, process id: %d', this.key, process.pid);
    this.client.get(this.key, function(err, res){
        if (err)
            throw err;
        callback(res);
    });
    logger.debug('Exiting - File: sharedVariable.js, Method: get, key: %s, process id: %d', this.key, process.pid);
};

/*
 * Async increment method.
 * 
 * callback - invoked upon completion of increment
 * 
 */
sharedVariable.prototype.incr = function(callback)
{
    logger.debug('Entering - File: sharedVariable.js, Method: incr, key: %s, process id: %d', this.key, process.pid);
    this.client.incr(this.key, function(err, res){
        if (err)
            throw err;
        callback(res);
    });
    logger.debug('Exiting - File: sharedVariable.js, Method: incr, key: %s, process id: %d', this.key, process.pid);
};

/*
 * Async decrement method.
 * 
 * callback - invoked upon completion of decrement
 * 
 */
sharedVariable.prototype.decr = function(callback)
{
    logger.debug('Entering - File: sharedVariable.js, Method: decr, key: %s, process id: %d', this.key, process.pid);
    this.client.decr(this.key, function(err, res){
        if (err)
            throw err;
        callback(res);
    });
    logger.debug('Exiting - File: sharedVariable.js, Method: decr, key: %s, process id: %d', this.key, process.pid);
};

/*
 * Clean up routine to release redis resources
 */
sharedVariable.prototype.quit = function()
{
    logger.debug('Entering - File: sharedVariable.js, Method: quit, key: %s, process id: %d', this.key, process.pid);
    this.client.quit();
    logger.debug('Exiting - File: sharedVariable.js, Method: quit, key: %s, process id: %d', this.key, process.pid);
};
module.exports = sharedVariable;