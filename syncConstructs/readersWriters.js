/*
 * Author:  Joey Whelan
 * This is the main executable.  It implements a monitor to synchronize reader and writer processes
*/

var async = require('async');
var cluster = require('cluster');
var domain = require('domain');
var logger = require('./logger');
var timestamper = require('./timeStamper');
var utilities = require('./utilities');
var condition = require('./condition');
var sharedVariable = require('./sharedVariable');
var lock = require('./lock');
var properties = require('./properties');
var psMap = {};

/* 
 * the master process initializes 2 condition variables, 2 shared variables, and 1 mutex lock.  It then
 * creates 4 instances of readers and writers that are synchronized via a monitor construct.
 */
if (cluster.isMaster)
{
    
    async.series([ function (callback1)
                   {    
                       utilities.initCondition('okToRead', callback1);
                   },
                   function (callback2)
                   {
                       utilities.initCondition('okToWrite', callback2);
                   },
                   function (callback3)
                   {
                       utilities.initSharedVariable('numReaders', 0, callback3);
                   },
                   function (callback4)
                   {
                       utilities.initSharedVariable('numWriters', 0, callback4);
                   },
                   function (callback5)
                   {
                       utilities.initLock('mutex', callback5);
                   }
                  ],
                  function(err)
                  {
                    if (err)
                        throw err;
                    
                    /*
                     * fork 4 readers and 4 writers
                     */
                    for (var i=1; i <=4; i++)
                    {
                        var reader = cluster.fork({processType : 'reader'});
                        var writer = cluster.fork({processType : 'writer'});
                        psMap[reader.process.pid] = 'reader';
                        psMap[writer.process.pid] = 'writer';
                    }
                    
                  }
    );
    
	cluster.on('disconnect', function(worker) {
	    var pid = worker.process.pid;
	    logger.info('%s %d died', psMap[pid], pid);
	});
}
/*
 * worker processes
 */
else
{
    logger.info('A %s is born, process id:%s', process.env.processType, process.pid);
    initDomain();
}

/*
 * 
 */
function initDomain()
{
    logger.debug('Entering - File: readersWriters.js, Method: initDomain, Process id:%d', process.pid);
    
    var d = domain.create();
  
    var numReaders = new sharedVariable('numReaders');
    var numWriters = new sharedVariable('numWriters');
    var okToRead, okToWrite, mutex;

    d.on('error', function (err) {
        try 
        {
            logger.error('Crash: ' + err.message);
            var killtimer = setTimeout(function() {process.exit(1);}, 10000);
            killtimer.unref();
            
            if (numReaders) numReaders.quit();
            if (numWriters) numWriters.quit();
            if (okToRead) okToRead.quit();
            if (okToWrite) okToWrite.quit();
            if (mutex) mutex.quit();
            cluster.worker.disconnect();
        }
        catch (exc)
        {
            console.log(timestamper() + 'Error encountered during crash recovery: ' + exc.message);
        }
    }); 
    
    /*
     * create condition variables and mutex lock
     */
    async.series([ function (callback1)
                   {    
                        okToRead = new condition('okToRead', callback1);
                   },
                   function (callback2)
                   {
                       okToWrite = new condition('okToWrite', callback2);
                   },
                   function (callback3)
                   {
                       mutex = new lock('mutex', callback3);
                   },
                   function (callback4)
                   {
                       /*
                        * after condition vars have been created, do 10 iterations of reading or writing, depending on process type
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
                                       logger.info('Iteration %d, %s %d', iteration, process.env.processType, process.pid);
                                       iteration++;
                                       switch (process.env.processType)
                                       {
                                           case 'reader' :
                                               read(mutex, numReaders, numWriters, okToRead, okToWrite, callback);
                                               break;
                                               
                                           case 'writer' :
                                               write(mutex, numReaders, numWriters, okToRead, okToWrite, callback);
                                               break;
                                       }
                                   },
                                   function (err) 
                                   {
                                       if (err)
                                           throw err;
                                       logger.info('%s %d signing off', process.env.processType, process.pid);
                                       numReaders.quit();
                                       numWriters.quit();
                                       okToRead.quit();
                                       okToWrite.quit();
                                       mutex.quit();
                                       logger.debug('Exiting - File: readersWriters.js, Method: initDomain, %s %d', process.env.processType,
                                               process.pid);
                                       callback4();
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
 * 
 */
function read(mutex, numReaders, numWriters, okToRead, okToWrite, readCB)
{
    logger.debug('Entering - File: readersWriters.js, Method: read, Process id:%d', process.pid);
    async.series(
                 [function(callback1)
                  {
                      logger.info('Reader %d attempting to gain read access', process.pid); 
                      var writers = 1;
                      async.whilst(  //loop until read access is available
                              function()
                              {
                                  return writers > 0;
                              },
                              function(cb1)
                              {
                                  mutex.acquire(function() {  //acquire monitor lock
                                      numWriters.get(function(res1) {  //fetch numWriters shared variable
                                          writers = res1;
                                          if (res1 == 0)  // if no writers are active, increment the numReaders shared var and release monitor lock
                                          {
                                              numReaders.incr(function(res2) {
                                                  mutex.release(function(){
                                                      cb1();
                                                  });
                                              }); 
                                          }
                                          else  //writers are active, wait on the okToRead cond var and release monitor lock
                                          {
                                              okToRead.wait(mutex, cb1);
                                          }
                                      });
                                  });
                              },
                              function(err)
                              {  
                                  if (err)
                                      throw err;
                                  callback1();  //writers was 0, reader gained access, exiting loop
                              }
                      );
                  },
                  function(callback2) 
                  {
                      logger.info('Reader %d gained read access', process.pid);
                      var readTime = utilities.randomPause(1,3); //1 to 3 seconds of simulated reading
                      setTimeout(function(){ logger.info('Reader %d finished reading', process.pid); callback2(); }, readTime);
                  },
                  function(callback3) 
                  {
                      logger.info('Reader %d releasing read access', process.pid);
                      mutex.acquire(function(){  //acquire monitor lock for the purpose of releasing a reader
                          numReaders.decr(function(res){  //decrement number of readers
                              if (res == 0)  // if num of readers is 0, signal a waiting writer
                              {
                                  okToWrite.signal(function(){
                                      mutex.release(function(){  //release monitor lock
                                         callback3(); //return
                                      });
                                  });
                              }
                              else  //num readers > 0, so just release the monitor lock and return
                              {  
                                  mutex.release(function(){ callback3();});
                              }
                          });
                      });
                  },
                  function(callback4)
                  {
                      logger.info('Reader %d processing data', process.pid);
                      var processingTime = utilities.randomPause(3,8);  //3 to 8 seconds of simulated data processing time
                      setTimeout(function(){ callback4(); }, processingTime);
                  }
                  ], 
                  function(err)
                  {
                     if (err)
                         throw err;
                     logger.debug('Exiting - File: readersWriters.js, Method: read, Process id:%d', process.pid);
                     readCB();
                  }
             );
};

function write(mutex, numReaders, numWriters, okToRead, okToWrite, writeCB)
{
    logger.debug('Entering - File: readersWriters.js, Method: write, Process id:%d', process.pid);
    
    async.series(
            [function(callback1)
             {
                 logger.info('Writer %d attempting to gain write access', process.pid); 
                 var writers = 1;
                 var readers = 1;
                 async.whilst(  //loop until write access is available, meaning - no readers or writers active
                         function()
                         {
                             return readers > 0 || writers > 0;
                         },
                         function(cb1)
                         {
                             mutex.acquire(function() {  //acquire monitor lock
                                 numReaders.get(function(res1){ //fetch numReaders shared variable
                                     readers = res1;
                                     if (res1 == 0)  //if no readers active, check number of writers
                                     {
                                         numWriters.get(function(res2){
                                             writers = res2;
                                             if (res2 == 0)  //if no writers active as well, increment numWriters and release monitor lock
                                             {
                                                 numWriters.incr(function(res3){
                                                     mutex.release(function(){
                                                         cb1();
                                                     });
                                                 });
                                             }
                                             else  //active writers are present, release monitor lock and wait
                                                 okToWrite.wait(mutex, cb1);
                                         });
                                     }
                                     else  //active readers are present, release monitor lock and wait
                                         okToWrite.wait(mutex, cb1);
                                 });
                             });
                         },
                         function(err)
                         {  
                             if (err)
                                 throw err;
                             callback1();  //number of readers and writers was 0, writer gained access, exiting loop
                         }
                 );
             },
             function(callback2) 
             {
                 logger.info('Writer %d gained write access', process.pid);
                 var writeTime = utilities.randomPause(1,3); //1 to 3 seconds of simulated wriing
                 setTimeout(function(){ logger.info('Writer %d finished writing', process.pid); callback2(); }, writeTime);
             },
             function(callback3) 
             {
                 logger.info('Writer %d releasing write access', process.pid);
                 mutex.acquire(function(){  //acquire monitor lock for the purpose of releasing a writer
                     numWriters.decr(function(res){  //decrement number of writers
                         okToWrite.signal(function(){  //signal 1 waiting writer
                             okToRead.signalAll(function(){  //signal all waiting readers
                                 mutex.release(function(){
                                     callback3();
                                 });
                             });
                         });
                     });    
                 });
             },
             function(callback4)
             {
                 logger.info('Writer %d processing data', process.pid);
                 var processingTime = utilities.randomPause(3,8);  //3 to 8 seconds of simulated data processing time
                 setTimeout(function(){ callback4(); }, processingTime);
             }], 
             function(err)
             {
                if (err)
                    throw err;
                logger.debug('Exiting - File: readersWriters.js, Method: write, Process id:%d', process.pid);
                writeCB();
             }
        );
};