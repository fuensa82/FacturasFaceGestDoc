cd ..
cd ..
cd ..
cd ..
cd ..
cd ..
cd scriptFacturasFace
echo *****************>> logs\log%date:~-4%_%date:~3,2%_%date:~0,2%.log
date /t >> logs\log%date:~-4%_%date:~3,2%_%date:~0,2%.log
time /t >> logs\log%date:~-4%_%date:~3,2%_%date:~0,2%.log
node GenerarTablaFacturas.js >> logs\log%date:~-4%_%date:~3,2%_%date:~0,2%.log
exit