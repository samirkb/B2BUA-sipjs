/**************************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
***************************************************************************************
 Description :  This file sets the basic environment file for the B2BUA server config
 Author      :  Samir Kumar Behera
 Date        :  01/25/2014
***************************************************************************************/
var env = process.env.NODE_ENV || 'development';
var config = require('./config')[env];
function getConf(){
  if(process.env.CONFIGURATION){
    return JSON.parse(process.env.CONFIGURATION);
  }else{
    return config;
  }
}

module.exports.getConf = getConf;
module.exports.configure = function(conf){
  process.env.CONFIGURATION = JSON.stringify(conf);
};




