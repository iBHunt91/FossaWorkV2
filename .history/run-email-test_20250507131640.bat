@echo off
echo Running email test with debugging...
set NODE_DEBUG=net,tls,smtp
node test-ssl-email.js
pause 