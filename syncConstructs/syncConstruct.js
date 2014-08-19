/*
 * Author:  Joey Whelan
 * Base object for building various synchronization contructs such as: semaphore, mutex lock, and condition.
*/

var redis = require('redis');
var os = require('os');
var logger = require('./logger');
var properties = require('./properties');

/*
 * Base constructor (asynchronous).  Prototypical inheritance is used to create the other synchronization objects.
 * 
 * key - string representing the name of the object.  Used to create the redis objects used for sync and queuing.
 * 
 * func - callback when the object has been created.  Invocation of the callback needs to wait till the redis 'subscribe' event
 * occurs
 * 
 */
function syncConstruct(key, func)
{
    logger.debug('Entering - File: syncConstruct.js, Method: syncConstruct, key:%s', key);
    if (key && func)
    {
        var self = this;
        self.key = key;
        self.cbMap = {};  //object map containing the callback functions of processes waiting to execute
        self.client = redis.createClient(properties.redisServer.port, properties.redisServer.host);  //redis command client
        self.subscriber = redis.createClient(properties.redisServer.port, properties.redisServer.host);  //redis subscription client
        var channel = self.key + ':' + os.hostname() + ':' + process.pid;
        
        self.subscriber.subscribe(channel);
        
        
        /*
         * When a process that was queued due to synchronization delay, it is 'signal'ed to resume via a redis publication.  The
         * 'on message' event triggers execution of the delayed process's callback function
         */
        self.subscriber.on('message', function(channel, msg){
            logger.debug('Entering - File: syncConstruct.js, Method: on message, channel: %s, pid: %d', channel, process.pid);
            var cbFunc = self.cbMap.channel;
            delete self.cbMap.channel;
            cbFunc();
            logger.debug('Exiting - File: syncConstruct.js, Method: on message channel: %s, pid: %d', channel, process.pid);
        });
        
        /*
         * Constructor callback is invoked upon receipt of the 'subscribe' event.  
         */
        self.subscriber.on('subscribe', function(channel, count){
            logger.debug('Entering - File: syncConstruct.js, Method: on subscribe, channel: %s, pid: %d', channel, process.pid);
            func();
            logger.debug('Exiting - File: syncConstruct.js, Method: on subscribe, channel: %s, pid: %d', channel, process.pid);
        });
        
    }
    logger.debug('Exiting - File: syncConstruct.js, Method: syncConstruct');
};

/*
 * Synchronization entrance routine.  Implements fair queuing (FIFO) for waiting processes.
 * Makes a Lua script call to redis to synchronize process entrance in a critical section.
 * 
 * luaScript - Lua redis script for managing synchronization entrance
 * 
 * callback1 - invoked when the synchronization gate has been passed
 * 
 * callback2 - only used for monitor condition wait calls.  contains callback to the monitor lock release
 * 
 */
syncConstruct.prototype.enter = function(luaScript, callback1, callback2)
{
    
    var self = this;
    var channel = self.key + ':' + os.hostname() + ':' + process.pid;
    logger.debug('Entering - File: syncConstruct.js, Method: enter, channel: %s', channel);
    self.cbMap.channel = callback1;
   
    self.client.eval(luaScript, 2, self.key, self.key + ':WaitQueue', channel, function (err, res){
        if (err)
        {
            throw err;
        }
            
        if (res > 0)  //will never be true for a condition variable wait method call
        {
            logger.debug('File: syncConstruct.js, Method: enter, passed eval script, res: %s, channel: %s, pid: %d', 
                    res, channel, process.pid);
            var func = self.cbMap.channel;
            
            if (func) 
            {
                delete self.cbMap.channel;
                func();
            }
        }
        
        if (callback2)  //covers the case of releasing a monitor lock after a process has been put in the wait queue
            callback2();
    });
    logger.debug('Exiting - File: syncConstruct.js, Method: enter, channel: %s', channel);
};

/*
 * Implements the routine to exit a critical section
 * 
 * luaScript - Lua script to invoke a Redis function that releases synchronization primitives for a critical section.  Implement fair
 *
 * queuing: if a process is waiting on a primitive, it is allowed to execute first.
 * 
 * callback - invoked when Lua script completes execution
 */
syncConstruct.prototype.exit = function(luaScript, callback)
{
    var self = this;
    logger.debug('Entering - File: syncConstruct.js, Method: exit, self.key: %s, queue: %s', self.key, self.key+':WaitQueue');
    self.client.eval(luaScript, 2, self.key, self.key + ':WaitQueue', function (err, res){
        if (err)
        {
            throw err;
        }
      
        if (res > 0)  
        {
            if (callback)
                callback();
        }
        else  //covers the case that a message is published but no process received it (process died for example)
        {
            logger.error('***File: syncConstruct.js, Method: exit, no process received published message to %s', self.key+':WaitQueue');
            self.exit(luaScript, callback);
        }
    });
    logger.debug('Exiting - File: syncConstruct.js, Method: exit');
};

/*
 * Clean up routine to release redis resources
 */
syncConstruct.prototype.quit = function()
{
    logger.debug('Entering - File: syncConstruct.js, Method: quit');
    this.client.quit();
    this.subscriber.quit();
    logger.debug('Exiting - File: syncConstruct.js, Method: quit');
};

module.exports = syncConstruct;
