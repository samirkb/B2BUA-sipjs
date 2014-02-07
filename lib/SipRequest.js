/******************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
 *******************************************************************************
 Description :   This file includes all the apis used for creating a SIP request
                 (Currently Supported Methods : INVITE, BYE,ACK). Even though
                 CANCEL method support has been added in this file, but it is
                 not used in call processing for now.
 Author      :   Samir Kumar Behera
 Date        :   01/25/2014
 *******************************************************************************/
var sip = require('sip');
var os = require('os');
var util = require('sys');
var logger = require('./logwinston');
var config = require('../config/conftool').getConf();
var sipHelper = require('./SipUtil');
var localhost = config.localhost;

exports.createSipRequest = function(msg,callInfo){
    switch(msg.method)
    {
        case 'INVITE':
        {
            var invite =null;
            /* Create Initial Invite */
            if(callInfo.inviteSent === 0)
            {
                invite = {
                    method: 'INVITE',
                    uri:  msg.uri,
                    headers: {
                        to: {uri: msg.headers.to.uri},
                        from: {uri: msg.headers.from.uri, params: {tag: callInfo.fromTag}},
                        'call-id': callInfo.callId,
                        cseq: {method: 'INVITE', seq: Math.floor(Math.random() * 1e5)},
                        contact: [{uri: 'sip:' + sipHelper.getUser(msg.headers.from.uri) + '@'+ localhost}],
                        'content-type': 'application/sdp'
                    },
                    via: [msg.headers.via[0]],
                    content:msg.content
                };
            }
            else  /* Create Re-Invite */
            {
                invite = {
                    method: 'INVITE',
                    uri:  msg.uri,
                    headers: {
                        to: {uri: msg.headers.to.uri,params: {tag: callInfo.toTag}},
                        from: {uri: msg.headers.from.uri, params: {tag: callInfo.fromTag}},
                        'call-id': callInfo.callId,
                        cseq :{method: 'INVITE', seq: Math.floor(Math.random() * 1e5)},
                        contact: [{uri: 'sip:' + sipHelper.getUser(msg.headers.from.uri) + '@'+ localhost}],
                        'content-type': 'application/sdp'
                    },
                    via: [msg.headers.via[0]],
                    content:msg.content
                };
            }
            return invite;
        }
        case 'BYE' :
        {
            /* Create Bye and return the message */
            var bye = {
                method: 'BYE',
                uri:  msg.uri,
                headers: {
                    to: {uri: msg.headers.to.uri ,params: {tag: callInfo.toTag}},
                    from: {uri: msg.headers.from.uri, params: {tag: callInfo.fromTag}},
                    'call-id': callInfo.callId,
                    cseq: {method: 'BYE', seq: Math.floor(Math.random() * 1e5)}
                },
                via: [msg.headers.via[0]]
            };
            return bye;
        }
        /* CANCEL Support is not added yet */
        case 'CANCEL' :
        {
            /* Create Cancel and return the message */
            var cancel = {
                method: 'CANCEL',
                uri:  msg.uri,
                headers: {
                    to: {uri: msg.headers.to.uri,params: {tag: callInfo.toTag}},
                    from: {uri: msg.headers.from.uri, params: {tag: callInfo.fromTag}},
                    'call-id': callInfo.callId,
                    cseq: {method: 'CANCEL', seq: callInfo.msgReq.headers.cseq.seq}
                },
                via: [msg.headers.via[0]]
            };
            return cancel;
        }
        default :
            logger.error('error',' Unsupported SIP Request Type');
            break;
    }
    return;
};

exports.createAck = function(msg,callInfo){
    /* Create Ack and return the message */
    var ack = {
        method:'ACK',
        uri:  msg.uri,
        headers: {
            to: {uri: msg.headers.to.uri ,params: {tag: callInfo.toTag}},
            from: {uri: msg.headers.from.uri, params: {tag: callInfo.fromTag}},
            'call-id': callInfo.callId,
            cseq: {method: 'ACK', seq: Math.floor(Math.random() * 1e5)}
        },
        via: [msg.headers.via[0]]
    };
    return ack;
};

