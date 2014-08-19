/*
 * Author:  Joey Whelan
 * This object implements a mutex lock.  Prototypical inheritance from the syncConstruct object.
*/

var logger = require('./logger');
var syncConstruct = require('./syncConstruct');

/*
 * Lua script to implement the acquire function of a loc.  
 * The redis key associated with the lock is fetched.  If it's greater 0, it's decremented and the process 
 * is able to enter its critical section.  Otherwise, the process's identifier is 'pushed' on to a wait queue (FIFO list).
 */
var acquireScript =  'local s = redis.call(\'get\', KEYS[1]) \
                      if (s and s + 0 > 0) then \
                         redis.call(\'decr\', KEYS[1]) \
                         return s \
                      else \
                         redis.call(\'lpush\',KEYS[2], ARGV[1]) \
                         return 0 \
                      end';

/*
 * Lua script to implement the release function of a loack.
 * To ensure 'fairness', the wait queue is first checked to see if it's non-empty. If there is a waiting process,
 * that process is allowed to proceed by publishing a message to a channel associated with its process
 * identifier.  If the wait queue is empty, the key associated with the lock is incremented to at most 1.
 */
var releaseScript =  'local pId = redis.call(\'rpop\', KEYS[2]) \
                     if (pId) then \
                        return redis.call(\'publish\', pId, \'release\') \
                     else \
                        local s = redis.call(\'get\', KEYS[1]) + 0 \
                        if (s and s + 0 < 1) then \
                            return redis.call(\'incr\', KEYS[1]) \
                        else \
                            return 1 \
                        end \
                     end';

/*
 * Prototypical inheritance (from syncConstruct) constructor.  Asynchronous
 * 
 * key - string representing the name of the object.  Used to create the redis objects used for sync and queuing.
 * 
 * func - callback when the object has been created.  
 * 
 */
function lock(key, func)
{
    logger.debug('Entering - File: lock.js, Method: lock, key:%s, process id:%d', key, process.pid);
    syncConstruct.call(this, key, func);
    logger.debug('Exiting - File: lock.js, Method: lock, key:%s, process id:%d', key, process.pid);
};

lock.prototype = new syncConstruct;

/*
 * Implementation of the acquire lock function.  Utilizes the parent object's generic entry function 
 * along with a lock-specific Lua script.
 * 
 * callback - invoked when the process is allowed entry to the critical section
 */
lock.prototype.acquire = function(callback)
{
    logger.debug('Entering - File: lock.js, Method: acquire, key:%s, process id:%d', this.key, process.pid);
    this.enter(acquireScript, callback);
    logger.debug('Exiting - File: lock.js, Method: acquire, key:%s, process id:%d', this.key, process.pid);
};

/*
 * Implementation of the release lock function.  Utilizes the parent object's generic exit function 
 * along with a lock-specific Lua script.
 * 
 * callback - invoked when the process has completed the redis commands for exiting
 */
lock.prototype.release = function(callback)
{
    logger.debug('Entering - File: lock.js, Method: release, key:%s, process id:%d', this.key, process.pid);
    this.exit(releaseScript, callback);
    logger.debug('Exiting - File: lock.js, Method: release, key:%s, process id:%d', this.key, process.pid);
};

module.exports = lock;
