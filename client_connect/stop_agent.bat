@echo off
setlocal
title NAS Manager - Ngat Ket Noi

echo.
echo  ================================================
echo      NAS MANAGER - NGAT KET NOI
echo  ================================================
echo.

echo  [INFO] Dang ngat ket noi...

:: Stop PM2 if running
call pm2 stop nas-agent >nul 2>&1

:: Kill normal node processes
wmic process where "name='node.exe' and commandline like '%%agent.js%%'" call terminate >nul 2>&1

echo  [OK] Da ngat ket noi thanh cong.

echo.
pause
