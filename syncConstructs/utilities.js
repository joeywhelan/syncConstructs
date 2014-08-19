/*
 * Author:  Joey Whelan
 * Helper functions for initializing Redis objects and generating random integers.
*/
 
var logger = require('./logger');
var properties = require('./properties');
var redis = require('redis');

module.exports = {
        /*
         * Initializes a semaphore by setting a Redis key to a value and deleting the Redis list object (wait queue) for that
         * key
         * 
         * key - string representing the name of the semaphore
         * 
         * val - initial value of the semaphore
         * 
         * callback - async function to be called when the redis functions complete execution
         */
        initSemaphore : function(key, val, callback)
        { 
            logger.debug('Entering - File: utilities.js, Method: initSemaphore, key: %s, val: %s', key, val);
            
            var client = redis.createClient(properties.redisServer.port, properties.redisServer.host);     
            if (!isNaN(val) && val >= 0)
            {
                var multi = client.multi();
                multi.set(key, val);
                multi.del(key + ':WaitQueue');
                multi.exec(function (err, res){
                    if (err)
                        throw err;
                    
                    multi.quit();
                    client.quit();
                    logger.debug('Exiting - File: utilities.js, Method: initSemaphore');
                    callback();
                });
            }
            else
                throw new Error('Invalid value parameter for semaphore initialization');
        },  
        
        /*
         * Initializes mutex lock by leveraging the semaphore initialization function.  A value of 1 is simply passed to that
         * function.
         * 
         * key - string representing the name of the lock
         * 
         * 
         * callback - async function to be called when the redis functions complete execution
         */
        initLock : function(key, callback)
        {
            logger.debug('Entering - File: utilities.js, Method: initLock, key: %s', key);
            this.initSemaphore(key, 1, callback);
            logger.debug('Exiting - File: utilities.js, Method: initlock');
        },
        
        /*
         * Initializes a condition variable by leveraging the semaphore initialization function.  A value of 0 is simply passed to that
         * function.
         * 
         * key - string representing the name of the lock
         * 
         * callback - async function to be called when the redis functions complete execution
         */
        initCondition : function(key, callback)
        {
            logger.debug('Entering - File: utilities.js, Method: initCondition, key: %s', key);
            this.initSemaphore(key, 0, callback);
            logger.debug('Exiting - File: utilities.js, Method: initCondition');
        },
        
        initSharedVariable : function(key, val, callback)
        {
            logger.debug('Entering - File: utilities.js, Method: initSharedVariable, key: %s, val: %s', key, val);
            var client = redis.createClient(properties.redisServer.port, properties.redisServer.host);     
            client.set(key, val, function(err, res){
                if (err)
                    throw err;
                client.quit();
                callback();
            });
            logger.debug('Exiting - File: utilities.js, Method: initSharedVariable');
        },
        /*
         * Generates a random number of milliseconds
         *
         * min - integer representing floor
         * max - integer representing ceiling
         */
        randomPause : function(min, max)  //random number of seconds between min and max
        {
            min *= 1000;
            max *= 1000;
            return (Math.floor(Math.random() * (max - min + 1)) + min);
        }
};