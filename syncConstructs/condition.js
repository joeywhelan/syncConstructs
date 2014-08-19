/*
 * Author:  Joey Whelan
 * This object implements a condition variable.  Prototypical inheritance from the syncConstruct object.
*/

var logger = require('./logger');
var syncConstruct = require('./syncConstruct');

/*
 * Lua script to implement the wait function of a condition variable.  Process's id is simply pushed on to a wait queue.  
 *
 */
var waitScript = 'redis.call(\'lpush\',KEYS[2], ARGV[1]) \
                  return 0';


/*
 * Lua script to implement the signal function of a condition variable.
 * To ensure 'fairness', FIFO behavior is maintained on the wait queue
 */
var signalScript = 'local pId = redis.call(\'rpop\', KEYS[2]) \
                    if (pId) then \
                       return redis.call(\'publish\', pId, \'signal\') \
                    else \
                       return 1 \
                    end';

/*
 * Similar to the above signal script, but with the add functionality of looping
 * thru all waiting processes on the wait queue
 */
var signalAllScript = 'local pId = redis.call(\'rpop\', KEYS[2]) \
                        while (pId) do \
                            redis.call(\'publish\', pId, \'signalAll\')\
                            pId = redis.call(\'rpop\', KEYS[2]) \
                        end \
                        return 1';
                        
/*
 * Prototypical inheritance (from syncConstruct) constructor.  Asynchronous
 * 
 * key - string representing the name of the object.  Used to create the redis objects used for sync and queuing.
 * 
 * func - callback when the object has been created.  
 * 
 */    
function condition(key, func)
{
    logger.debug('Entering - File: condition.js, Method: condition, key:%s, process id:%d', key, process.pid);
    syncConstruct.call(this, key, func);
    logger.debug('Exiting - File: condition.js, Method: condition, key:%s, process id:%d', key, process.pid);
};

condition.prototype = new syncConstruct;

/*
 * Implementation of the wait condition variable function.  Utilizes the parent object's generic entry function 
 * along with a condition-specific Lua script.
 * 
 * callback - invoked when the process is allowed entry to the critical section
 */
condition.prototype.wait = function(lock, callback)
{
    logger.debug('Entering - File: condition.js, Method: wait, key:%s, process id:%d', this.key, process.pid);
    this.enter(waitScript, callback, function(){ lock.release(); });
    logger.debug('Exiting - File: condition.js, Method: wait, key:%s, process id:%d', this.key, process.pid);
};

/*
 * Implementation of the signal condition function.  Utilizes the parent object's generic critical section exit function 
 * along with a condition-specific Lua script.
 * 
 * callback - invoked when the process has completed the redis commands for exiting
 */
condition.prototype.signal = function(callback)
{
    logger.debug('Entering - File: condition.js, Method: signal, key:%s, process id:%d', this.key, process.pid);
    this.exit(signalScript, callback);
    logger.debug('Exiting - File: condition.js, Method: signal, key:%s, process id:%d', this.key, process.pid);
};

/*
 * Implementation of the signal all condition function.  Utilizes the parent object's generic critical section exit function 
 * along with a condition-specific Lua script.
 * 
 * callback - invoked when the process has completed the redis commands for exiting
 */
condition.prototype.signalAll = function(callback)
{
    logger.debug('Entering - File: condition.js, Method: signalAll, key:%s, process id:%d', this.key, process.pid);
    this.exit(signalAllScript, callback);
    logger.debug('Exiting - File: condition.js, Method: signalAll, key:%s, process id:%d', this.key, process.pid);
};

module.exports = condition;