@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title NAS Manager - Client Connect Setup

set "APP_DIR=%~dp0"
set "NODE_DIR=%APP_DIR%node_portable"
set "PATH=%NODE_DIR%;%APP_DIR%;%PATH%"

echo.
echo  ================================================================
echo      NAS MANAGER - CLIENT CONNECT SETUP (OFFLINE)
echo  ================================================================
echo.

:: 0. Check node.exe exists
if not exist "%NODE_DIR%\node.exe" (
    echo  [ERROR] Khong tim thay node.exe tai:
    echo    %NODE_DIR%\node.exe
    echo  Hay kiem tra lai thu muc node_portable!
    goto :FAIL
)

:: 0b. Check client_connect.js exists
if not exist "%APP_DIR%client_connect\client_connect.js" (
    echo  [ERROR] Khong tim thay client_connect.js tai:
    echo    %APP_DIR%client_connect\client_connect.js
    echo  Hay kiem tra lai thu muc client_connect!
    goto :FAIL
)

:: 1. Firewall (optional - requires Admin)
net session >nul 2>&1
if !errorlevel! equ 0 (
    echo  [1/3] Mo cong Tuong Lua 22 ^(SSH^) va 3001 ^(WS^)...
    netsh advfirewall firewall add rule name="NAS Agent SSH" dir=in action=allow protocol=TCP localport=22 >nul 2>&1
    netsh advfirewall firewall add rule name="NAS Agent WS" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
    echo  [OK] Da cau hinh Firewall.
) else (
    echo  [1/3] Khong co quyen Admin - Bo qua cau hinh Firewall.
    echo         ^(Agent van chay duoc, nhung co the can mo port thu cong^)
)

:: 2. Configure Agent Connection
echo.
echo  [2/3] Cau hinh ket noi...
echo  ================================================
echo   NHAP THONG TIN KET NOI SERVER
echo  ================================================
echo  (Neu ban chay Agent tren cung may voi Server, dung: localhost)
set /p SERVER_IP="  IP cua NAS Server (Default: localhost): "
if "!SERVER_IP!"=="" set SERVER_IP=localhost

set /p MACHINE_ID="  Machine ID (xem trong Dashboard): "

if "!MACHINE_ID!"=="" (
    echo  [ERROR] Machine ID khong duoc de trong!
    goto :FAIL
)

echo.
echo  [3/3] Dang khoi tao cau hinh...
cd /d "%APP_DIR%client_connect"
"%NODE_DIR%\node.exe" client_connect.js --setup --server ws://!SERVER_IP!:3001/ws/agent --machine-id !MACHINE_ID!

if !errorlevel! neq 0 (
    echo.
    echo  [ERROR] Khoi tao cau hinh that bai!
    echo  Kiem tra lai: IP Server (!SERVER_IP!), Machine ID (!MACHINE_ID!)
    goto :FAIL
)

echo.
echo  ================================================================
echo   [THANH CONG] Cau hinh Client Connect hoan tat!
echo  ================================================================
echo.
pause
exit /b 0

:FAIL
echo.
echo  Nhan phim bat ky de dong...
pause >nul
exit /b 1
