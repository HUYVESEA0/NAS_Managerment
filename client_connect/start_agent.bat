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

:: Chay ngam (Hidden)
echo  [INFO] Dang ket noi toi NAS Server...
powershell -Command "Start-Process node -ArgumentList 'agent.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

echo  [OK] Da ket noi thanh cong (chay ngam).
echo.
echo  De ngat ket noi: chay 'stop_agent.bat'
echo.
pause
