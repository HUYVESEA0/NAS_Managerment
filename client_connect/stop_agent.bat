@echo off
setlocal
title Stop NAS Agent

echo ========================================================
echo      STOP NAS REMOTE AGENT
echo ========================================================
echo.

echo [INFO] Stopping agent process...
wmic process where "name='node.exe' and commandline like '%%agent.js%%'" call terminate >nul 2>&1

if %errorlevel% equ 0 (
    echo [SUCCESS] Stopped successfully.
) else (
    echo [WARN] Could not find running agent or failed to stop.
)

echo.
pause
