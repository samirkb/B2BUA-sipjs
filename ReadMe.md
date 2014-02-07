/********************************************************************************
 US211553: Evaluation of sip.js by implementing a B2BUA 
*********************************************************************************
Description :  This file is created to capture the details about the B2BUA server
               implementation to evaluate the sip.js stack
Author      :  Samir Kumar Behera
Date        :  01/25/2014
*********************************************************************************/

Project Intent :     
===============
sip.js implements a simple SIP protocol stack with the following features:
(1)SIP Message Parser
(2)UDP, TCP and TLS based transport
(3)Transactions
(4)Digest Authentication

This project was executed to evaluate the sip.js stack and to find out any challenges (if any)
which an user can face while developing a sip application on the top of the sip stack. It
is a lightweight B2BUA server implementation and does not represent entire rfc3261 standard
compliance/representation.

Following are few evaluation details :

(1)Sip.js provides few basic functionalities to the user/developer by default and  application
development required for a implementing complete solution ( rfc3261), as expected in most of the
cases
(2) Dialogue handling is not included as a part of the default call processing capability and hence
need to implement an application to test this capability.The main focus of implementing the B2BUA app. 
is to implement the dialog handling and to verify the stack processing capabilities.
(3) Sending SIP responses using SDP or headers like ( expires,contact,etc) is not included in the
default logic. But the implementation provides enough clues to implement these kind of logic.

Pre-requisites
==============
(1) Node.js installed and the project added to a generic IDE ( e.g Intellij,Eclipse,etc)
(2) npm installed ("npm install" command from the command line)
(3) sip.js installed ("npm install sip" command from the command line

Steps to run/execute the project
================================
(1) Go to the  "\B2BUA\config\" folder and set the basic configuration ( localhost,sipport,
outbound proxy) in the config.js file
(2) Go to the "\B2BUA\"  folder and run the sip-server.js file from the IDE
(3) Configure and register sip soft clients (e.g Xlite, zoiper,etc) to the B2BUA.
Ensure that the soft phones are registered prior to making any calls
(4) Make basic calls 


NOTE :  The current implementation supports registration,subscription, basic  A to B call scenario 
and Re-INVITE +info support has been added without any specialized handling/processing. Error handling
,Cancel handling,etc has not been included in the current scope and shall be added later.





