/*
 * Author:  Joey Whelan
 * This is the main executable.  It implements the Dining Philosophers (DP) problem via semaphores
*/

var async = require('async');
var cluster = require('cluster');
var domain = require('domain');
var logger = require('./logger');
var timestamper = require('./timeStamper');
var utilities = require('./utilities');
var semaphore = require('./semaphore');
var properties = require('./properties');

/* 
 * the master process initializes 5 semaphores representing the 'forks' in the DP problem then
 * create 5 worker processes representing the philosophers
 */
if (cluster.isMaster)
{
    var forkNum = 1;
    async.whilst(
            function() 
            { 
                return forkNum <= 5;
            },
            function(callback) 
            {
                utilities.initSemaphore('fork' + forkNum, 1, function(){ forkNum++; callback();});
            },
            function (err) 
            {
                if (err)
                    throw err;
                for (var i=1; i <= 5; i++)
                    cluster.fork();
            }
    );
    
	cluster.on('disconnect', function(philosopher) {  //philosopher died
		logger.info('Philosopher %d died', philosopher.id);
	});
}
/*
 * worker processes (philosophers)
 */
else
{
    logger.info('Philosopher %d is born, process id:%s', cluster.worker.id, process.pid);
    initDomain();
}

/*
 * Main routine implementing the DP scenario
 */
function initDomain()
{
    logger.debug('Entering - File: dining.js, Method: initDomain, Philosopher id:%d', cluster.worker.id);
    var d = domain.create();
    var leftFork, rightFork, leftForkNum, rightForkNum;
    
    /*
     * Allocate the fork names on the left and right hand sides of the philosopher
     */
    if (cluster.worker.id != 5)
    {
        rightForkNum = 'fork' + cluster.worker.id;
        leftForkNum = 'fork' + (parseInt(cluster.worker.id) + 1);
    }
    else
    {
        rightForkNum = 'fork' + 5;
        leftForkNum = 'fork' + 1;
    }
    
    d.on('error', function (err) {
        try 
        {
            logger.error('Crash: ' + err.message);
            var killtimer = setTimeout(function() {process.exit(1);}, 10000);
            killtimer.unref();
            
            rightFork.quit();
            leftFork.quit();
            cluster.worker.disconnect();
        }
        catch (exc)
        {
            console.log(timestamper() + 'Error encountered during crash recovery: ' + exc.message);
        }
    }); 
    
    /*
     * create semaphores representing the left and right hand forks
     */
    async.series([ function (callback1)
                   {    
                        rightFork = new semaphore(rightForkNum, callback1);
                   },
                   function (callback2)
                   {
                       leftFork = new semaphore(leftForkNum, callback2);
                   },
                   function (callback3)
                   {
                       /*
                        * after semaphores have been created, do 10 iterations of getting forks, eating, and thinking
                        */
                       var iteration = 1;
                       d.run(function() {
                           async.whilst(
                                   function() 
                                   { 
                                       return iteration <= 10;
                                   },
                                   function(callback) 
                                   {
                                       logger.info('Iteration %d, Philosopher %d', iteration, cluster.worker.id);
                                       iteration++;
                                       live(rightFork, leftFork, callback);
                                   },
                                   function (err) 
                                   {
                                       if (err)
                                           throw err;
                                       logger.info('Philosopher %d signing off', cluster.worker.id);
                                       rightFork.quit();
                                       leftFork.quit();
                                       logger.debug('Exiting - File: dining.js, Method: initDomain, Philosopher id:%d', cluster.worker.id);
                                       callback3();
                                   }
                           );
                       });
                   }
                  ],
                  function(err)
                  {
                    if (err)
                        throw err;
                    cluster.worker.disconnect();
                  }
    );
};

/*
 * function representing the life of a philosopher:  acquire right fork and left fork via semaphores, eat for a random period,
 * return the right and left forks, then think about the meaning of life for a random period
 */
function live(rightFork, leftFork, liveCB)
{
    logger.debug('Entering - File: dining.js, Method: live, Philosopher id:%d', cluster.worker.id);
    async.series(
                 [function(callback1) 
                  {
                     logger.info('Philosopher %d attempting to acquire %s', cluster.worker.id, rightFork.key); 
                     rightFork.P(callback1);
                  },
                  function(callback2)
                  {
                      logger.info('Philosopher %d attempting to acquire %s', cluster.worker.id, leftFork.key); 
                      leftFork.P(callback2);
                  },
                  function(callback3) 
                  {
                      logger.info('Philosopher %d acquired forks and starting to eat', cluster.worker.id);
                      var eatTime = utilities.randomPause(1,3); //1 to 3 seconds
                      setTimeout(function(){ logger.info('Philosopher %d finished eating', cluster.worker.id); callback3(); }, eatTime);
                  },
                  function(callback4) 
                  {
                      logger.info('Philosopher %d returning %s', cluster.worker.id, rightFork.key);
                      rightFork.V(callback4);
                  },
                  function(callback5) 
                  {
                      logger.info('Philosopher %d returning %s', cluster.worker.id, leftFork.key);
                      leftFork.V(callback5);
                  },
                  function(callback6) 
                  {
                      logger.info('Philosopher %d starting to think', cluster.worker.id);
                      var thinkTime = utilities.randomPause(1,3); //1 to 3 seconds
                      setTimeout(function(){ logger.info('Philosopher %d finished thinking', cluster.worker.id); callback6(); }, thinkTime);
                  }], 
                  function(err){
                     if (err)
                         throw err;
                     liveCB();
                 }
             );
};