@echo off
setlocal
title NAS Manager - Client Connect

echo.
echo  ================================================
echo      NAS MANAGER - CLIENT CONNECT
echo  ================================================
echo.

:: Kiem tra da setup chua
if not exist "agent.config.json" (
    echo  [ERROR] Chua cau hinh!
    echo  Vui long chay 'setup_agent.bat' truoc.
    echo.
    pause
    exit /b
)

echo   [1] Chay Agent (Cua so Console hien thi)
echo   [2] Chay Agent (Background via PM2)
echo.
set /p mode=  Chon che do (1-2): 

if "!mode!"=="2" (
    call run_pm2.bat
    exit /b
)

:: Chay Agent Console
cls
echo  [INFO] Dang ket noi toi NAS Server...
echo.
node agent.js
pause
