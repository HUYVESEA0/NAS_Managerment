@echo off
setlocal EnableDelayedExpansion
title NAS Agent Setup Wizard

echo ========================================================
echo      NAS AGENT - REMOTE MACHINE SETUP
echo ========================================================
echo.

:: 1. Kiem tra Node.js
echo [1/4] Kiem tra Node.js...

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Node.js chua duoc cai dat!
    echo [AUTO] Dang tai Node.js LTS (v20.11.0 x64) tu nodejs.org...
    echo Vui long doi trong giay lat...
    
    :: Download Node.js installer
    powershell -Command "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'node_setup.msi' -ErrorAction Stop } catch { exit 1 }"
    
    if not exist "node_setup.msi" (
        echo [ERROR] Tai xuong that bai! Vui long kiem tra mang hoac cai thu cong tai: https://nodejs.org/
        pause
        exit /b
    )

    echo [INSTALL] Dang chay bo cai dat...
    echo Vui long chon 'Next' de cai dat mac dinh.
    start /wait node_setup.msi
    
    :: Cleanup installer
    del node_setup.msi
    
    echo.
    echo ========================================================
    echo [YEU CAU KHOI DONG LAI]
    echo Node.js da duoc cai dat. Vui long TAT CUA SO NAY va
    echo CHAY LAI 'setup_agent.bat' de he thong nhan dien.
    echo ========================================================
    pause
    exit /b
)
echo [OK] Node.js da san sang.

:: 2. Cai dat dependencies
echo.
echo [2/4] Cai dat thu vien (npm install)...
if not exist "node_modules\" (
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Khong the cai dat dependencies.
        pause
        exit /b
    )
) else (
    echo [OK] Thu vien da duoc cai dat.
)

:: 3. Kiem tra config
echo.
echo [3/4] Cau hinh ket noi...
if exist "agent.config.json" (
    echo [INFO] Phat hien config cu. Ban co muon setup lai tu dau?
    set /p RELOAD="Setup lai (Y/N)? "
    if /i "!RELOAD!" neq "Y" goto SETUP_DONE
)

echo.
echo --- NHAP THONG TIN SERVER ---
set /p SERVER_IP="Nhap IP cua NAS Server (VD: 192.168.1.10): "
set /p MACHINE_ID="Nhap Machine ID (VD: 2): "

echo.
echo [INFO] Ban co muon cau hinh SSH Auto-Bind khong? (De server tu dong login SSH)
set /p SETUP_SSH="Cau hinh SSH (Y/N)? "

set SSH_ARGS=
if /i "%SETUP_SSH%"=="Y" (
    set /p SSH_USER="SSH Username (VD: admin): "
    set /p SSH_PASS="SSH Password: "
    set SSH_ARGS=--ssh-user !SSH_USER! --ssh-pass !SSH_PASS!
)

:: 4. Chay Setup Wizard
echo.
echo [4/4] Dang ket noi va cau hinh...
echo.
node agent.js --setup --server ws://!SERVER_IP!:3001/ws/agent --machine-id !MACHINE_ID! !SSH_ARGS!

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Setup that bai. Kiem tra lai IP Server hoac Machine ID.
    pause
    exit /b
)

:SETUP_DONE
echo.
echo ========================================================
echo [SUCCESS] Setup hoan tat!
echo Agent da san sang hoat dong.
echo.
echo De chay agent, hay dung file 'start_agent.bat'
echo ========================================================
pause
