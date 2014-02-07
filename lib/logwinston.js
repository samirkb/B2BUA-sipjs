/******************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
 *******************************************************************************
 Description :   This file implements a logger module for display logs
                 This file is being re-used
 Author      :   Samir Kumar Behera
 Date        :   01/25/2014
 *******************************************************************************/

var winston = require('winston');
var config = require('../config/conftool').getConf();

var transports;
if(process.env.UPSTART){
  transports =  [ new(winston.transports.Console)(
    {colorize: false, prettyPrint: true, json: false, timestamp: true, handleExceptions: true})];
}else{
  transports = [ new(winston.transports.Console)(
    {colorize: true, prettyPrint: true, json: false, timestamp: true, handleExceptions: true})];
}

var logger = new(winston.Logger)({
	transports: transports, exitOnError: true
});

module.exports = logger;

