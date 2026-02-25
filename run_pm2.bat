@echo off
setlocal EnableDelayedExpansion
title NAS Manager — PM2 Controller

:MENU
cls
echo.
echo  ================================================
echo       NAS MANAGER — PM2 CONTROLLER
echo  ================================================
echo.
echo   [1] Start Service (Run All)
echo   [2] Restart Service
echo   [3] Stop Service
echo   [4] View Logs (Realtime)
echo   [5] View Status (Dashboard)
echo   [6] Install PM2 Global (Neu chua co)
echo   [0] Thoat
echo.
set /p choice=  Chon (0-6): 

if "!choice!"=="1" goto START
if "!choice!"=="2" goto RESTART
if "!choice!"=="3" goto STOP
if "!choice!"=="4" goto LOGS
if "!choice!"=="5" goto STATUS
if "!choice!"=="6" goto INSTALL_PM2
if "!choice!"=="0" exit
goto MENU

:START
cls
echo  [PM2] Dang khoi dong cac dich vu...
if not exist "logs" mkdir logs
call pm2 start ecosystem.config.js
echo.
pause
goto MENU

:RESTART
cls
echo  [PM2] Dang restart...
call pm2 restart ecosystem.config.js
echo.
pause
goto MENU

:STOP
cls
echo  [PM2] Dang dung cac dich vu...
call pm2 stop ecosystem.config.js
echo.
pause
goto MENU

:LOGS
cls
echo  [PM2] Bam [Ctrl+C] de thoat khoi man hinh Log.
echo.
call pm2 logs
goto MENU

:STATUS
cls
call pm2 status
echo.
pause
goto MENU

:INSTALL_PM2
cls
echo  [INSTALL] Dang cai dat PM2 Global...
call npm install pm2 -g
echo.
pause
goto MENU
