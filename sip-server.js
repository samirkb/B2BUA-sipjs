/********************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA
*********************************************************************************
 Description :  This file is the starting point/trigger to the B2BUA sip server
                This file needs to be executed in the IDE to start the
                B2BUA sip server
 Author      :  Samir Kumar Behera
 Date        :  01/25/2014
*********************************************************************************/
var b2bua = require('./B2bua.js');
b2bua.start(function(opts){});

