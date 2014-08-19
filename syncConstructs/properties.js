
/**
 * This code provides user-configurable options
 * 
 * Author: Joey Whelan
 *
 */

var properties = {};

properties.logLevel = 'info';  //log level. options:  debug, info, error
properties.logFile = './sync.log';  //path log file
properties.logSize = 50000000; //max log file size in bytes
properties.maxLogFiles = 2;  //number of log files to retain
properties.redisServer = {host : 'localhost', port : 6379};

module.exports = properties;