@echo off
setlocal
title NAS Remote Agent Service

echo ========================================================
echo      NAS REMOTE AGENT - STARTING...
echo ========================================================
echo.

:: 1. Kiem tra config
if not exist "agent.config.json" (
    echo [ERROR] Agent chua duoc cau hinh!
    echo Vui long chay 'setup_agent.bat' truoc.
    pause
    exit /b
)

:: 2. Chay agent (Hidden)
echo [INFO] Dang khoi dong NAS Agent (An)...
powershell -Command "Start-Process node -ArgumentList 'agent.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

echo.
echo [SUCCESS] Agent da duoc khoi dong chay ngam.
echo De dung Agent, chay file 'stop_agent.bat'.
echo.
pause
