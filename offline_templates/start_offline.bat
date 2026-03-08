@echo off
setlocal EnableDelayedExpansion
title NAS Manager — Offline Launcher

:: Get network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "NET_IP=%%a"
    set "NET_IP=!NET_IP: =!"
    goto :GOT_IP
)
:GOT_IP
if not defined NET_IP set "NET_IP=localhost"

set "APP_DIR=%~dp0"
set "NODE_DIR=%APP_DIR%node_portable"
set "PATH=%NODE_DIR%;%APP_DIR%;%PATH%"

:MENU
cls
echo.
echo  ================================================
echo    NAS MANAGER — OFFLINE LAUNCHER
echo    IP: !NET_IP!
echo  ================================================
echo.
echo   [1] Start All Services  (PM2)
echo   [2] Stop All Services
echo   [3] Restart Services
echo   [4] View Status
echo   [5] View Logs
echo   [6] Direct Start  (Khong dung PM2)
echo   [0] Thoat
echo.
set /p choice=  Chon (0-6): 

if "!choice!"=="1" goto PM2_START
if "!choice!"=="2" goto PM2_STOP
if "!choice!"=="3" goto PM2_RESTART
if "!choice!"=="4" goto PM2_STATUS
if "!choice!"=="5" goto PM2_LOGS
if "!choice!"=="6" goto DIRECT_START
if "!choice!"=="0" exit
goto MENU

:PM2_START
cls
echo  [PM2] Khoi dong dich vu...
if not exist "logs" mkdir logs
call "%APP_DIR%pm2.cmd" start ecosystem.config.js
echo.
echo  ================================================
echo   He thong dang chay!
echo   Web UI:   http://!NET_IP!:3001
echo   API:      http://!NET_IP!:3001/api
echo   Agent WS: ws://!NET_IP!:3001/ws/agent
echo  ================================================
pause
goto MENU

:PM2_STOP
cls
call "%APP_DIR%pm2.cmd" stop all
echo  [DONE] Da dung tat ca dich vu.
pause
goto MENU

:PM2_RESTART
cls
call "%APP_DIR%pm2.cmd" restart all
echo  [DONE] Da khoi dong lai.
pause
goto MENU

:PM2_STATUS
cls
call "%APP_DIR%pm2.cmd" status
echo.
pause
goto MENU

:PM2_LOGS
cls
echo  Nhan Ctrl+C de thoat.
call "%APP_DIR%pm2.cmd" logs
goto MENU

:DIRECT_START
cls
echo  [DIRECT] Khoi dong truc tiep khong can PM2...
echo.
echo  ================================================
echo   Server:   http://!NET_IP!:3001
echo   Agent WS: ws://!NET_IP!:3001/ws/agent
echo  ================================================
echo.
set NODE_ENV=production
set PORT=3001
start "NAS Server" "%NODE_DIR%\node.exe" "%APP_DIR%server\index.js"
start "NAS Client Connect" "%NODE_DIR%\node.exe" "%APP_DIR%client_connect\client_connect.js"
echo  Dang chay. Nhan phim bat ky de quay lai menu.
pause
goto MENU
