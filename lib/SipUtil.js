/*********************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
***********************************************************************************
 Description :  This file implements various utility api's used during the call
                processing.
 Author      :  Samir Kumar Behera
 Date        :  01/25/2014
***********************************************************************************/
var sip = require('sip'),
uuid = require('node-uuid'),
util = require('util');
var logger = require('./logwinston');
var config = require('../config/conftool').getConf();
var localhost = config.localhost;

function rstring() {
	return Math.floor(Math.random() * 1e6).toString();
}

function getAlias(sipuri){
  console.log("getting alias"); 
  if(sipuri.indexOf("@") > -1){
    var front = sipuri.split('@')[0];
    if(front.indexOf("sip:") > -1){
      return front.split(":")[1];
    }else{
      console.log(front);
      return front;
    }
  }else{
    return sipuri;
  }
}

function SipUtil() {
    console.log("Sip Util created");
}

function getUser(sipuri){
    var user = sip.parseUri(sipuri).user;
    return (user);
}

exports.getUser = getUser;

exports.getCallId = function(msg){
    return [msg.headers['call-id']];
};

exports.getLocalId = function(msg) {
    return [msg.headers['call-id'], msg.headers.to.params.tag, msg.headers.from.params.tag].join(':');
};

exports.getRemoteId = function(msg){
  if(msg.headers.to && msg.headers.from){
    return [msg.headers['call-id'], msg.headers.to.params.tag, msg.headers.from.params.tag].join(':');
  }else{
    return null;
  }
};

exports.createContact = function(req) {
       return ['sip:',getUser(req.headers.to.uri),'@',localhost].join('');
};

exports.getTag = function(sipuri){
    var user = getUser(sipuri);

    if(user)
    {

    }

};





