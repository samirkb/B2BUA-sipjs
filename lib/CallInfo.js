/******************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
*********************************************************************************
 Description :   This file includes all the api's used for handling (get/set)
                 call session information. Typically, two call sessions gets
                 created for a single call. One for the originating call leg
                 (i.e. orig party to B2BUA) and other for the destination call
                 Leg (i.e B2BUA to destination party)
 Author      :   Samir Kumar Behera
 Date        :   01/25/2014
*********************************************************************************/
var sipHelper = require('./SipUtil');
var HashTable = require('./HashTable.js');
var os = require('os');
var uuid = require('node-uuid');
var sip = require('sip');
var logger = require('./logwinston');
var hashTable = new HashTable();

CallInfo.prototype.dialogId = 0;
CallInfo.prototype.otherdialogId = 0;
CallInfo.prototype.callId =0;
CallInfo.prototype.toTag = '';
CallInfo.prototype.fromTag = '';
CallInfo.prototype.toHeader =0;
CallInfo.prototype.fromHeader ="";
CallInfo.prototype.branch =0;
CallInfo.prototype.callSeq =0;
CallInfo.prototype.callState ='';
CallInfo.prototype.callDir = '';
CallInfo.prototype.contact = '';
CallInfo.prototype.inviteSent = 0;
CallInfo.prototype.msgReq = '';
CallInfo.prototype.via = '';

/* Some of the call info parameters are not getting used
 * in the current call processing, but has been added for
 * future use
 */
function CallInfo(){
    this.dialogId = 0;
    this.otherDialogId = 0;
    this.callId = 0;
    this.toTag = '';
    this.fromTag='';
    this.branch = 0;
    this.callSeq = 0;
    this.callState = '';
    this.callDir = '';
    this.contact = '';
    this.inviteSent = 0;
    this.toHeader =0;
    this.fromHeader ='';
    this.msgReq = '';
    this.via ='';
}

function rstring() {
    return Math.floor(Math.random() * 1e6).toString();
}

/* Store the callInfo (value) in the hash table based upon the
 * dialog ID( key). DialogID to CallInfo mapping is stored
 */
CallInfo.prototype.setCallInfo = function(key ,value)
{
    hashTable.put(key,value);
    logger.log('info','Successfully added the callInfo for Dialog :',key);
    return;
};

/* Get the callInfo (value) for the current message under processing.
 * Logic retrieves the CallInfo is retrieved based upon the unique dialog ID
 */
CallInfo.prototype.getCallInfo = function(msg) {

    var dialogId = [msg.headers['call-id'], msg.headers.to.params.tag, msg.headers.from.params.tag].join(':');
    var tempCallInfo = null;

   /* Get the callInfo from the current dialog */
    tempCallInfo = this.getValue(dialogId);

    if(tempCallInfo)
    {
        return(tempCallInfo);
    }
    else
    {
       /* Either it could be an out of dialog message
        *                 OR
        * It is an in dialog message, but the message
        * is being originated by destination party
        * with the respect to the ongoing call
        * Swap the from & to tag seq in the dialog ID
        * and verify if the call Info is available or not
        */
        dialogId = [msg.headers['call-id'], msg.headers.from.params.tag, msg.headers.to.params.tag].join(':');
        tempCallInfo = this.getValue(dialogId);
        return tempCallInfo;
    }
};


/* Get the callInfo (value) from the hash table based upon the
 * dialog ID( key). CallInfo is retrieved based upon the unique
 * dialog ID
 */
CallInfo.prototype.getValue = function(key)
{
    var value = hashTable.get(key);
    if(value)
    {
        logger.log('info','Successfully retrieved the callInfo for Dialog :',key);
    }
    return(value);
};

/* Once the Dialog ID has changed ( to tag received from destination
 * party , following api removes and updates the dialog (key)
 * & callInfo (value) accordingly
 */
CallInfo.prototype.removeAndUpdateCallInfo = function(oldkey,newkey,value)
{
    logger.log('info','Removing CallInfo for dialogId', oldkey );
    hashTable.remove(oldkey);

    logger.log('info','Updating CallInfo for dialogId', newkey);
    hashTable.put(newkey,value);
    value.dialogId = newkey;
    return;
};


/* Set various call information into the call session/info structure
 * from the message under processing. These information shall be used
 * later during the call processing. Not all the params are set or used
 * currently and shall be used as and when required.
 */
CallInfo.prototype.setCallLeg = function(callLeg,req){

     if(callLeg && req){

       /* Store the to and from Tag and this will be used
        * for while sending messages to the appropriate
        * call Leg
        */
        callLeg.fromHeader = req.headers.from.uri;
        callLeg.toHeader = req.headers.to.uri;
        callLeg.toTag = req.headers.to.params.tag;
        callLeg.fromTag = req.headers.from.params.tag;

       /* For originating Leg , just store the values received
        * from the message.
        * For destination Leg, create new call id, from tag
        */
        if(callLeg.callDir === 'orig')
        {
            // Store the values
            callLeg.callId = sipHelper.getCallId(req);
            callLeg.branch =  req.headers.via[0].params.branch;
            callLeg.dialogId = [req.headers['call-id'], req.headers.to.params.tag, req.headers.from.params.tag].join(':');
            callLeg.callSeq = req.headers.cseq.seq;
            callLeg.branch  = req.headers.via[0].params.branch;


           /* Set and store the necessary params for handling/managing
            * subsequent calls.
            * (1) Need to store the invite request ,as it shall be
            * used for sending any response messages to the
            * orig party ( callee)
            * (2) Create and store the contact header
            * in the callerLeg ( orig party) , as that is required
            * while forwarding any request messages to the callee
            * The contact header should include the destination
            * party username
            */
            callLeg.contact = sipHelper.createContact(req);
            callLeg.msgReq = req;
        }
        else if(callLeg.callDir === 'dest')
        {
            // Create callId and from/to tag
            callLeg.callId = rstring();
            callLeg.fromTag = rstring();
            callLeg.toTag = '';
            callLeg.dialogId = [callLeg.callId, callLeg.toTag, callLeg.fromTag].join(':');
        }
        logger.log('info','Call Leg Created for dialog', callLeg.dialogId);
        return(callLeg);
    }
    else{
        logger.log('error','Invalid CallLeg');
        return (0);
    }
};

/* Following api sets the correct from-uri to from tag & to-uri to to-tag
 * mapping during the call processing. During an on going call, in case a
 * request is received from the destination party (e.g. BYE or Re-INVITE,etc)
 * the from and to tag gets swapped and need to be mapped again
 */
CallInfo.prototype.verifyTags = function(msg,callInfo){

    if(((callInfo.toHeader !== msg.headers.to.uri) && (callInfo.toHeader === msg.headers.from.uri ))  &&
        ((callInfo.fromHeader !== msg.headers.from.uri) && (callInfo.fromHeader === msg.headers.to.uri)))
    {
       /* Message is originated from destination party of the ongoing call
        * Need to swap the tags for correct settings
        */
        var tempTag = null;
        tempTag = callInfo.toTag;
        callInfo.toTag = callInfo.fromTag;
        callInfo.fromTag = tempTag;
        logger.log('info','Successfully modified Tags');
    }
    return;
};


/* Clear all the call session/info structures and hash table
 * once the call is terminated
 */
CallInfo.prototype.clearCallInfo = function(callLeg,otherCallLeg){

   /* Remove the callInfo and key from the hash table
    * Clear the callInfo and delete the callInfo objects
    */

    if(callLeg)
    {
        hashTable.remove(callLeg.dialogId);
    }
    if(otherCallLeg)
    {
        hashTable.remove(otherCallLeg.dialogId);
    }
    delete hashTable;
    return;
};

module.exports = CallInfo;