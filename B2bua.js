/******************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
*******************************************************************************
 Description :  This file is created to implement a B2BUA logic (Dialog Support)
                which is not supported by sip.js by default.The logic supports
                basic registartion and call sceanrio. The intent is to just
                verify a basic successfull call and load testing.Error handling,
                CANCEL support,etc shall be added later.
 Author      :  Samir Kumar Behera
 Date        :  01/25/2014
********************************************************************************/
var sip = require('sip');
var uuid = require('node-uuid');
var sdpHelper = require('sip/sdp');
var os = require('os');
var proxy = require('sip/proxy');
var util = require('sys');
var logger = require('./lib/logwinston');
var CallInfo = require('./lib/CallInfo.js');
var sipReq = require('./lib/SipRequest');
var sipUtil = require('./lib/SipUtil');
var config = require('./config/conftool').getConf();



var contacts = {};
var sipServer = null;
var callInfo = new CallInfo();

function b2bua() {
    this.server = null;
}

/* API to create and start the B2BUA. It uses the configured localhost and sipport
 * for opening the socket
 */
b2bua.prototype.start = function(opts){
    var self = this;
    var siplog = {
        send: function(message, address) {
            logger.log('info', 'send to ' + address.address + ':' + address.port + '\n' + sip.stringify(message));
        },
        recv: function(message, address) {
            logger.log('info', 'recv from ' + address.address + ':' + address.port + '\n' + sip.stringify(message));
        },
        error: function(e){
            logger.log('error', e.stack);
        }
    }
    logger.log('info', 'B2BUA started Succesfully and listening on port : ',opts.sipport);
    self.server = sip.create({port:opts.sipport,publicAddress:opts.outboundproxy,logger: siplog}, self.handleSIPMessage.bind(self));
};

/* API to stop the B2BUA server */
b2bua.prototype.stop = function () {
     sip.stop(function () {
    });
};

/* API to handle incoming SIP Messages and in the current logic
 * processing has been added for few of the messages
 */
b2bua.prototype.handleSIPMessage = function(rq){

    logger.log('info','SipServer handleRequest received an request :',rq.method);
    var self = this;

    switch(rq.method){
        case 'REGISTER':
        {
           /* Need to store the user's contact , which shall
            * be used for sending subsequent messages to the
            * specific user. Set the same expires as received
            * from the user agent
            */
            var user = sip.parseUri(rq.headers.to.uri).user;
            contacts[user] = rq.headers.contact;
            self.server.send(sip.makeResponseWithExpires(rq, 200, "OK"));
        }
            break;
        case 'SUBSCRIBE':
        {
           /* No special processing for Subscription added for now
            * and hence setting larger expiration value to avoid
            * frequent re-subscriptions
            */
            rq.headers.expires = 600000;
            self.server.send(sip.makeResponseWithExpires(rq, 200, "OK"));;
        }
        break;
        case 'OPTIONS':
        case 'INFO':
        {
           /* For now, no special handling added for these
            * messages
            */
            self.server.send(sip.makeResponse(rq, 200, "OK"));
        }
        break;
        case 'BYE':
        {
            self.server.send(sip.makeResponse(rq, 200, "OK"));
            self.handleSipRequest(rq);
        }
        break;
        case 'CANCEL':
        {
            self.server.send(sip.makeResponse(rq, 487,"Request Terminated"));
            self.handleSipRequest(rq);
        }
        break;
        case 'INVITE':
        {
            self.server.send(sip.makeResponse(rq, 100, "Trying"));
            self.handleInvite(rq);
        }
        break;
        default:
            self.server.send(sip.makeResponse(rq, 405, "Method Not Allowed"));
            break;
    }
    return;
};

/* API to handle INVITE request ( including re-INVITEs) */
b2bua.prototype.handleInvite = function(msg){

    var self = this;
    var sessionInfo = null;
    var callerLeg = null;
    var calleeLeg = null;
    var rs;

    /* Make sure the user is registered and if not, then reject the proessing
     * with 404 response code
     */
    var user = sip.parseUri(msg.uri).user;
    if(!(contacts[user] && Array.isArray(contacts[user]) && contacts[user].length > 0))
    {
        self.server.send(sip.makeResponse(msg, 404, "User Not Found"));
        return;
    }
    else {
        msg.uri = contacts[user][0].uri;
    }

    /* Get callInfo based upon the call id of the incoming INVITE
     * if callInfo is NULL , then this is an initial Invite ( call Init)
     * and need to create callee & called party callInfo
     * If callInfo is not NULL, then it is an in dialog message
     * and process it accordingly
     */

    sessionInfo = callInfo.getCallInfo(msg);

    if(sessionInfo == null)
    {
       /* New Call initiation and hence create the callee and called party
        * legs ,store the call info and map the call legs
        */
        if(!callerLeg){
            /* Create a callerLeg ( Origination Party)
             * leg and set all the necessary informationm
             * required for the ongoing call
             */
            callerLeg = new CallInfo();
            callerLeg.callDir = 'orig';
            callerLeg.callState = 'callProceeding';
            callerLeg.setCallLeg(callerLeg,msg);
        }

        if(!calleeLeg){
           /* Create a calleeLeg ( destination Party)
            * leg and set all the necessary informationm
            * required for the ongoing call
            */
            calleeLeg = new CallInfo();
            calleeLeg.callDir = 'dest';
            calleeLeg.callState = 'callProceeding';
            calleeLeg.setCallLeg(calleeLeg,msg);
        }

       /* Store the call Leg mapping. This information shall
        * be used  for retrieving the callInfo of other leg
        */
        if(callerLeg && calleeLeg)
        {
            callerLeg.otherDialogId = calleeLeg.dialogId;
            calleeLeg.otherDialogId = callerLeg.dialogId;
        }

       /* Create  Invite , replace from tag and Callid with the newly assigned
        * values and send it towards the destination party
        */

        var invite = sipReq.createSipRequest(msg,calleeLeg);

        /* Copy the transaction information*/
        calleeLeg.callSeq = invite.headers.cseq.seq;
        self.server.send(invite,self.handleResponses.bind(self));

       /* Set and store the necessary params for handling/manaing
        * subsequent calls.
        * (1) invitesent flag can be used in future for
        * handing re-invites
        * (2) Need to store the invite request ,as it shall be
        * used for sending any response messages to the
        * called party ( callee)
        * (3) Store the contact header of the newly created invite
        *  in the calleeLeg ( dest party) , as that is required
        *  while forwarding any request messages to the callee
        */

        calleeLeg.inviteSent = callerLeg.inviteSent = 1;
        calleeLeg.msgReq = invite;

        /* Store the Caller and Callee callInfo using the
         * dialog ID as the key. CallInfo can be retreived
         * later during the call processing using the specific
         * dialogID
         */
        callerLeg.setCallInfo(callerLeg.dialogId,callerLeg);
        calleeLeg.setCallInfo(calleeLeg.dialogId,calleeLeg);

        /* Uncomment the following for displaying the callee and
         * called party leg information
         */
        //logger.log('info', 'calleeLeg: ', calleeLeg);
        //logger.log('info', 'callerLeg: ', callerLeg)
    }
    else
    {
        /* handle re-INVITEs */
        console.log(" In dialog INVITE rxd");
        self.handleSipRequest(msg);
    }
};

/* API to handle SIP requests other than INVITE. Only the following
 * set of Request messages are supported for now
 */
b2bua.prototype.handleSipRequest = function(msg){

    var self = this;
    var sessionInfo = null;

   /* Make sure the user is registered and if not, then reject the proessing
    * with 404 response code
    */
    var user = sip.parseUri(msg.uri).user;
    if(!(contacts[user] && Array.isArray(contacts[user]) && contacts[user].length > 0))
    {
        self.server.send(sip.makeResponse(msg, 404, "User Not Found"));
        return;
    }
    else {
        msg.uri = contacts[user][0].uri;
    }

   /* Get callInfo based upon the call id of the incoming INVITE
    * if callInfo is NULL , then this is an initial Invite ( call Init)
    * and need to create callee & called party callInfo
    * If callInfo is not NULL, then it is an in dialog message
    * and process it accordingly
    */
    sessionInfo = callInfo.getCallInfo(msg);

    /* Existing dialog */
    if(sessionInfo)
    {
        /* Get the other call leg , so as to forward the message */
        var OtherCall = null;
        OtherCall =  callInfo.getValue(sessionInfo.otherDialogId);

        if(OtherCall)
        {
            /* map the tag to a specific user . This is required
             * for handling messages originated by the destination
             * party
             */
            callInfo.verifyTags(msg,OtherCall);

            /* Appropriate Cancel handling shall be done later */
            if(msg.method == 'CANCEL')
            {
                self.server.send(sip.makeResponse(OtherCall.msgReq,503,"Server Internal Error"));
            }
            else
            {
              /* Create message and send it to the other leg */
                var req = sipReq.createSipRequest(msg,OtherCall);
                self.server.send(req,self.handleResponses.bind(self));
            }
        }
        else
        {
            self.server.send(sip.makeResponse(msg, 410, "User Does Not Exist"));
        }

        if(msg.method === 'BYE' || msg.method === 'CANCEL')
        {
           /* Clear all the resources of the call anyways */
            callInfo.clearCallInfo(sessionInfo,OtherCall);
            delete sessionInfo;
            delete OtherCall;
            delete callInfo;
        }
    }
    else
    {
        self.server.send(sip.makeResponse(msg, 481, "Transaction Not Found"));
        return;
    }
};

/* API to handle all the SIP Responses. Only the following set of
 * SIP responses are handled. Other are just forwarded to the other
 * party
 */
b2bua.prototype.handleResponses = function(message){
    var type = null;
    type = (message.method) ? message.method : message.status ;
    var newMessage = null;
    var self = this;
    var destCallInfo = null;
    var origCallInfo = null;

    /* Ignore the call processing for 100 trying/101 and response code handling for a BYE */
    if ((type != null && (type != 100 && type != 101)) && (message.headers.cseq.method != "BYE"))
    {
        /* Make sure the user is registered and if not, then reject the processing
         * with 404 response code
         */
        var user = sip.parseUri(message.headers.to.uri).user;
        if(!(contacts[user] && Array.isArray(contacts[user]) && contacts[user].length > 0))
        {
            self.server.send(sip.makeResponse(message, 404, "User Not Found"));
            return;
        }
        else {
            message.uri = contacts[user][0].uri;
        }

        /* Get the callInfo based for the current dialog ID for processing the
         * response message
         */
        destCallInfo = callInfo.getCallInfo(message);

        /* In case callInfo is not available for the current dialog,then
         * there could be either of the following two scenario:
         * (1) It is an out of dialog message and must be rejected
         *                  OR
         * (2) It is an indialog message with toTag being received in the
         * response message. Initially the callInfo is stored only using
         * from tag & call Id as toTag is not available
         */

        if(!destCallInfo)
        {
            /* Retrieve the original callInfo using the origDialog ID (from tag & call ID)
             * In case callInfo is availale then remove the callInfo & dialog ID mapping from
             * the hastable and add the callInfo using the updated/current dialogID.
             * If callInfo is not available, then reject the call using 481 (ood)
             */
            var tempDialogId = [message.headers['call-id'],'', message.headers.from.params.tag].join(':');
            destCallInfo = callInfo.getValue(tempDialogId);

            if(destCallInfo) // In Dialog message
            {
                /* Get the current dialog ID */
                var dialogId = [message.headers['call-id'], message.headers.to.params.tag, message.headers.from.params.tag].join(':');

                destCallInfo.toTag = message.headers.to.params.tag;
                callInfo.removeAndUpdateCallInfo(tempDialogId,dialogId,destCallInfo);

                /* Get the other dialog id from the call info. Add a new toTag and remove/upate
                 * the originating party callInfo prior to forwarding the message to  orig party
                 */
                origCallInfo = callInfo.getValue(destCallInfo.otherDialogId);

                if(origCallInfo)
                {
                    tempDialogId = null;
                    var user = sip.parseUri(message.headers.to.uri).user;
                    origCallInfo.toTag = rstring();

                    /* remove and update the tag */
                    origCallInfo.msgReq.headers.to.params.tag = origCallInfo.toTag;
                    tempDialogID = [origCallInfo.callId, origCallInfo.toTag, origCallInfo.fromTag].join(':');
                    callInfo.removeAndUpdateCallInfo(origCallInfo.dialogId,tempDialogID,origCallInfo);

                    /* Update the mapping also */
                    destCallInfo.otherDialogId = origCallInfo.dialogId;
                    origCallInfo.otherDialogId = destCallInfo.dialogId;
                }
                else {
                    logger.error('error','Originating Call leg not found & rejecting the call for message : ',type);
                    self.server.send(sip.makeResponse(message, 503, "Server Internal Error"));
                    return;
                }
            }
            else // Out of Dialog
            {
                logger.error('error','Out of dialog messgae & rejecting the call');
                self.server.send(sip.makeResponse(message, 481,"Transaction Not Found"));
                return;
            }
        }
        else
        {
            /* Get the other dialog id from the call info. This callInfo must have been
             * already updated once the toTag was received earlier
             */
            origCallInfo = callInfo.getValue(destCallInfo.otherDialogId);

            if(!origCallInfo)
            {
                logger.log('error','Originating Call leg not found 2 & rejecting the call for message : ',type);
                self.server.send(sip.makeResponse(message, 503, "Server Internal Error"));
                return;
            }
        }

        //logger.log('info', 'Response message : ', message);
        //logger.log('info', 'Destination CallInfo : ', destCallInfo);

        if(message.headers.cseq.method == "INVITE")
        {
            switch(type){
                case 180:
                    destCallInfo.callState = origCallInfo.callState = "Ringing";
                    self.server.send(sip.makeResponse(origCallInfo.msgReq, 180,"Ringing"));
                    break;
                case 200:
                    destCallInfo.callState = origCallInfo.callState = "Call Accepted";

                    /* Prior to forwarding the message to originating party , do the following
                     * (1) Swap the SDP : Use the SDP being sent by the destination party
                     * (2) Set the contact accordingly
                     */
                    origCallInfo.msgReq.content = null
                    origCallInfo.msgReq.headers.contact = null;
                    origCallInfo.msgReq.content = message.content;
                    origCallInfo.msgReq.headers.contact = origCallInfo.contact;

                    self.server.send(sip.makeResponseWithSDP(origCallInfo.msgReq, 200,"OK"));

                    /* Send Ack to the destination Party */
                    var ack = sipReq.createAck(message,destCallInfo);
                    self.server.send(ack,self.handleResponses.bind(self));
                    break;
                default :
                    self.server.send(sip.makeResponse(origCallInfo.msgReq, type,"OK"));
                    logger.info('info',' Forwarding Unsupported message !!' , type);
                    return;
            }
        }
    }else {
        logger.log('info', ' Ignoring call processing ');
    }
    return;
};

/* Util api */
function rstring() {
    return Math.floor(Math.random() * 1e6).toString();
}

module.exports.start = function(opts){
    if(sipServer){
        sipServer.start(config);
    }else{
        sipServer = new b2bua();
        sipServer.start(config);
    }
}

module.exports.stop = function(cb){
    if(sipServer){
        try{
            sipServer.stop();
            cb();
        }catch(e){
            cb();
            logger.error('error','Stop request with no session');
        }
    }else{
        cb();
    }
}