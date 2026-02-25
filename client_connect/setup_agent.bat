@echo off
setlocal EnableDelayedExpansion
title NAS Manager - Client Connect Setup

cls
echo.
echo  ================================================
echo      NAS MANAGER - CLIENT CONNECT SETUP
echo  ================================================
echo.

:: 1. Kiem tra Node.js
echo  [1/4] Kiem tra Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] Node.js chua duoc cai dat!
    echo  [AUTO] Dang tai Node.js LTS ...
    echo.

    powershell -Command "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'node_setup.msi' -ErrorAction Stop } catch { exit 1 }"

    if not exist "node_setup.msi" (
        echo  [ERROR] Tai xuong that bai!
        echo  Vui long cai thu cong tai: https://nodejs.org/
        pause
        exit /b
    )

    echo  [INSTALL] Dang cai Node.js...
    start /wait node_setup.msi
    del node_setup.msi

    echo.
    echo  ================================================
    echo   [YEU CAU] Vui long DONG va CHAY LAI file nay
    echo   de he thong nhan dien Node.js vua cai.
    echo  ================================================
    pause
    exit /b
)
echo  [OK] Node.js da san sang.

:: 2. Cai dat dependencies
echo.
echo  [2/4] Cai dat thu vien...
if not exist "node_modules\" (
    call npm install
    if !errorlevel! neq 0 (
        echo  [ERROR] Khong the cai dat dependencies.
        pause
        exit /b
    )
) else (
    echo  [OK] Thu vien da duoc cai dat.
)

:: 3. Kiem tra config
echo.
echo  [3/4] Kiem tra cau hinh...
if exist "agent.config.json" (
    echo  [INFO] Tim thay cau hinh cu.
    set /p RELOAD="  Setup lai tu dau? (Y/N): "
    if /i "!RELOAD!" neq "Y" goto SETUP_DONE
)

:: 4. Nhap thong tin
echo.
echo  ================================================
echo   NHAP THONG TIN KET NOI SERVER
echo  ================================================
echo  (Neu ban chay Agent tren cung may voi Server, dung: localhost)
set /p SERVER_IP="  IP cua NAS Server (Default: localhost): "
if "!SERVER_IP!"=="" set SERVER_IP=localhost

set /p MACHINE_ID="  Machine ID (xem trong Dashboard): "

echo.
echo  [4/4] Dang ket noi va cau hinh...
echo.
node agent.js --setup --server ws://!SERVER_IP!:3001/ws/agent --machine-id !MACHINE_ID!

if !errorlevel! neq 0 (
    echo.
    echo  [ERROR] Ket noi that bai!
    echo  Kiem tra lai: IP Server (!SERVER_IP!), Machine ID (!MACHINE_ID!)
    pause
    exit /b
)

:SETUP_DONE
echo.
echo  ================================================
echo   [THANH CONG] Cau hinh hoan tat!
echo.
echo   Chay 'start_agent.bat' de bat dau ket noi.
echo  ================================================
pause
