@echo off
setlocal EnableDelayedExpansion
title NAS Manager - Server Setup

set "APP_DIR=%~dp0"
set "NODE_DIR=%APP_DIR%node_portable"
set "PATH=%NODE_DIR%;%APP_DIR%;%PATH%"

echo.
echo  ================================================================
echo    NAS MANAGER — SERVER SETUP
echo  ================================================================
echo.

:: 1. Check Admin privileges
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo  [ERROR] Vui long chay script nay voi quyen Administrator!
    pause
    exit /b 1
)

:: 2. Configure Firewall
echo  [1/3] Cau hinh Firewall...
netsh advfirewall firewall show rule name="NAS_Manager_Server_Web" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="NAS_Manager_Server_Web" dir=in action=allow protocol=TCP localport=3001,5173 >nul
    echo  [OK] Da tao Firewall rule cho port 3001 va 5173.
) else (
    echo  [OK] Firewall da duoc cau hinh tu truoc.
)

:: 3. Disable PM2 Cloud (Offline mode) — write config directly instead of
:: calling pm2.cmd (which would spawn a daemon under Admin elevation)
echo  [2/3] Tat ket noi PM2 Cloud (Offline mode)...
if not exist "%APP_DIR%.pm2" mkdir "%APP_DIR%.pm2" 2>nul
echo {} > "%APP_DIR%.pm2\agent.json5" 2>nul
echo  [OK] PM2 Cloud da duoc tat.

:: 4. Setup Database
echo  [3/3] Khoi tao Database...

:: Stop PM2 processes first so Prisma DLL is not locked
echo  - Dung server tam thoi de cap nhat database...
call "%APP_DIR%pm2.cmd" stop all >nul 2>&1

cd /d "%APP_DIR%server"

:: Get Node binary path
set "NODE_BIN=%NODE_DIR%\node.exe"

if not exist "prisma\dev.db" (
    echo  - Tao database moi...
    "%NODE_BIN%" node_modules\prisma\build\index.js migrate dev --name init
    echo  - Nhap du lieu mac dinh...
    "%NODE_BIN%" node_modules\prisma\build\index.js db seed
) else (
    echo  - Database da ton tai, cap nhat schema...
    "%NODE_BIN%" node_modules\prisma\build\index.js generate
    "%NODE_BIN%" node_modules\prisma\build\index.js migrate deploy
)
cd /d "%APP_DIR%"

echo.
echo  ================================================================
echo   [DONE] Cau hinh he thong hoan tat!
echo  ================================================================
echo.
pause
