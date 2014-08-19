/*
 * Author:  Joey Whelan
 * This object implements a semaphore.  Prototypical inheritance from the syncConstruct object.
*/

var logger = require('./logger');
var syncConstruct = require('./syncConstruct');

/*
 * Lua script to implement the P function of a semaphore.  
 * The redis key associated with the semaphore is fetched.  If it's greater 0, it's returned (and that process 
 * is able to enter its critical section).  Otherwise, the process's identifier is 'pushed' on to a wait queue (FIFO list).
 */
var pScript =  'local s = redis.call(\'get\', KEYS[1])\
                if (s and s + 0 > 0) then \
                    redis.call(\'decr\', KEYS[1]) \
                    return s \
                else \
                    redis.call(\'lpush\',KEYS[2], ARGV[1]) \
                    return 0 \
                end';

/*
 * Lua script to implement the V function of a semaphore.
 * To ensure 'fairness', the wait queue is first checked to see if it's non-empty. If there is a waiting process,
 * that process is allowed to proceed by publishing a message to a channel associated with its process
 * identifier.  If the wait queue is empty, the key associated with the semaphore is simply incremented.
 */
var vScript =  'local pId = redis.call(\'rpop\', KEYS[2]) \
                if (pId) then \
                    return redis.call(\'publish\', pId, \'V\') \
                else \
                    return redis.call(\'incr\', KEYS[1]) \
                end';

/*
 * Prototypical inheritance (from syncConstruct) constructor.  Asynchronous
 * 
 * key - string representing the name of the object.  Used to create the redis objects used for sync and queuing.
 * 
 * func - callback when the object has been created.  
 * 
 */
function semaphore(key, func)
{
    logger.debug('Entering - File: semaphore.js, Method: semaphore, key: %s, process id: %d', key, process.pid);
    syncConstruct.call(this, key, func);
    logger.debug('Exiting - File: semaphore.js, Method: semaphore, key: %s, process id: %d', key, process.pid);
};

semaphore.prototype = new syncConstruct;

/*
 * Implementation of the P semaphore function.  Utilizes the parent object's generic entry function 
 * along with a semaphore-specific Lua script.
 * 
 * callback - invoked when the process is allowed entry to the critical section
 */
semaphore.prototype.P = function(callback)
{
    logger.debug('Entering - File: semaphore.js, Method: P, key: %s, process id: %d', this.key, process.pid);
    this.enter(pScript, callback);
    logger.debug('Exiting - File: semaphore.js, Method: P, key: %s, process id: %d', this.key, process.pid);
};

/*
 * Implementation of the V semaphore function.  Utilizes the parent object's generic critical section exit function 
 * along with a semaphore-specific Lua script.
 * 
 * callback - invoked when the process has completed the redis commands for exiting
 */
semaphore.prototype.V = function(callback)
{
    logger.debug('Entering - File: semaphore.js, Method: V, key: %s, process id: %d', this.key, process.pid);
    this.exit(vScript, callback)
    logger.debug('Exiting - File: semaphore.js, Method: V, key: %s, process id: %d', this.key, process.pid);
};

module.exports = semaphore;