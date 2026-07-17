@echo off
title School Study Portal - Public
echo ============================================
echo   School Study Portal - Public Access
echo ============================================
echo.

:: Start the Node.js server
echo [1/2] Starting server...
start /B node server.js
timeout /t 3 /nobreak >nul

:: Get public URL via localtunnel
echo [2/2] Creating public tunnel...
echo.
start /B npx localtunnel --port 3000 --subdomain school-study-portal

echo.
echo ============================================
echo  Server is running!
echo  Local:    http://localhost:3000
echo  Network:  http://%COMPUTERNAME%:3000
echo ============================================
echo.
echo  Check the tunnel terminal for the public URL.
echo  It will look like: https://some-name.loca.lt
echo.
echo  Press any key to stop all services...
pause >nul

:: Cleanup
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM lt.exe >nul 2>&1
echo Services stopped.
