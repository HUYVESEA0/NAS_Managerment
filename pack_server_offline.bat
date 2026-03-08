@echo off
setlocal EnableDelayedExpansion
title NAS Manager — Server Package Builder

cls
echo.
echo  ================================================================
echo    NAS MANAGER — SERVER PACKAGE BUILDER
echo  ================================================================
echo    Tao goi cai dat Offline de mang sang may Doanh Nghiep.
 echo    Yeu cau: May nay phai co internet + da cai Node.js + dependencies.
echo  ================================================================
echo.

:: ---- CONFIG ----
set "SRC_DIR=%~dp0"
set "DIST_DIR=%~dp0SERVER_PACKAGE"
set "NODE_DIR=%DIST_DIR%\node_portable"

:: ---- STEP 0: Clean old package ----
if not exist "%DIST_DIR%" goto :SKIP_CLEAN
echo  [WARN] Thu muc SERVER_PACKAGE da ton tai.
set /p overwrite=  Ghi de? (y/N): 
if /i not "!overwrite!"=="y" (
    echo  Huy bo.
    pause
    exit /b
)
echo  Dang xoa goi cu...
rmdir /s /q "%DIST_DIR%"
:SKIP_CLEAN
mkdir "%DIST_DIR%" 2>nul

:: ---- STEP 1: Ensure all dependencies are installed ----
echo.
echo  [1/6] Kiem tra va cai dat dependencies...

echo  - Root (PM2)...
cd /d "%SRC_DIR%"
call npm install --prefer-offline
if !errorlevel! neq 0 echo  [WARN] Root npm install co loi, tiep tuc...

echo  - Server...
cd /d "%SRC_DIR%server"
call npm install --prefer-offline
if !errorlevel! neq 0 echo  [WARN] Server npm install co loi, tiep tuc...

echo  - Client...
cd /d "%SRC_DIR%client"
call npm install --prefer-offline
if !errorlevel! neq 0 echo  [WARN] Client npm install co loi, tiep tuc...

cd /d "%SRC_DIR%"

:: ---- STEP 2: Build Client for Production ----
echo.
echo  [2/6] Build Client (Production)...
cd /d "%SRC_DIR%client"
call npm run build
if !errorlevel! neq 0 (
    echo  [ERROR] Build client THAT BAI!
    pause
    exit /b 1
)
cd /d "%SRC_DIR%"

:: ---- STEP 3: Generate Prisma Client ----
echo.
echo  [3/6] Generate Prisma Client...
cd /d "%SRC_DIR%server"
call npx prisma generate
cd /d "%SRC_DIR%"

:: ---- STEP 4: Copy project files ----
echo.
echo  [4/6] Copy ma nguon va dependencies...

:: Server (with node_modules) — robocopy xu ly deep paths tot hon xcopy
:: /XF *.db — khong copy database files (se duoc tao moi bang migrate deploy tren may target)
echo  - Copying server...
robocopy "%SRC_DIR%server" "%DIST_DIR%\server" /E /NFL /NDL /NJH /NJS /nc /ns /np /XF *.db /XF .env.local >nul 2>&1
if !errorlevel! geq 8 echo  [WARN] robocopy server co loi (errorlevel !errorlevel!)

:: Dam bao thu muc prisma/migrations ton tai (can thiet cho migrate deploy)
if not exist "%DIST_DIR%\server\prisma\migrations" mkdir "%DIST_DIR%\server\prisma\migrations" 2>nul

:: Client dist only (no need for source in production)
echo  - Copying client/dist...
robocopy "%SRC_DIR%client\dist" "%DIST_DIR%\client\dist" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
if !errorlevel! geq 8 echo  [WARN] robocopy client/dist co loi

:: Root files
echo  - Copying root files...
copy "%SRC_DIR%package.json" "%DIST_DIR%\" >nul 2>&1
copy "%SRC_DIR%package-lock.json" "%DIST_DIR%\" >nul 2>&1
:: (Removed dev .bat files here)

:: ecosystem.config.js — chi co nas-server
echo  - Tao ecosystem.config.js (server only)...
echo module.exports = {> "%DIST_DIR%\ecosystem.config.js"
echo     apps: [>> "%DIST_DIR%\ecosystem.config.js"
echo         {>> "%DIST_DIR%\ecosystem.config.js"
echo             name: "nas-server",>> "%DIST_DIR%\ecosystem.config.js"
echo             script: "./server/index.js",>> "%DIST_DIR%\ecosystem.config.js"
echo             cwd: ".",>> "%DIST_DIR%\ecosystem.config.js"
echo             env: {>> "%DIST_DIR%\ecosystem.config.js"
echo                 NODE_ENV: "production",>> "%DIST_DIR%\ecosystem.config.js"
echo                 PORT: 3001>> "%DIST_DIR%\ecosystem.config.js"
echo             },>> "%DIST_DIR%\ecosystem.config.js"
echo             watch: false,>> "%DIST_DIR%\ecosystem.config.js"
echo             max_memory_restart: "1G",>> "%DIST_DIR%\ecosystem.config.js"
echo             log_date_format: "YYYY-MM-DD HH:mm:ss",>> "%DIST_DIR%\ecosystem.config.js"
echo             error_file: "./logs/server-error.log",>> "%DIST_DIR%\ecosystem.config.js"
echo             out_file: "./logs/server-out.log",>> "%DIST_DIR%\ecosystem.config.js"
echo         }>> "%DIST_DIR%\ecosystem.config.js"
echo     ]>> "%DIST_DIR%\ecosystem.config.js"
echo };>> "%DIST_DIR%\ecosystem.config.js"

:: Root node_modules (contains PM2) — use robocopy to handle deep paths
echo  - Copying root node_modules (PM2)...
robocopy "%SRC_DIR%node_modules" "%DIST_DIR%\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
if !errorlevel! geq 8 echo  [WARN] robocopy root node_modules co loi

:: Logs folder
mkdir "%DIST_DIR%\logs" 2>nul

:: ---- STEP 5: Bundle Node.js Portable ----
echo.
echo  [5/6] Tao Node.js Portable...
mkdir "%NODE_DIR%" 2>nul

:: Copy the Node.js binary and essential files
set "NODE_INSTALL=C:\Program Files\nodejs"
if exist "%NODE_INSTALL%\node.exe" (
    echo  - Copying node.exe...
    copy "%NODE_INSTALL%\node.exe" "%NODE_DIR%\" >nul 2>&1
    
    :: Copy npm files
    echo  - Copying npm...
    if exist "%NODE_INSTALL%\npm.cmd" copy "%NODE_INSTALL%\npm.cmd" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\npm" copy "%NODE_INSTALL%\npm" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\npx.cmd" copy "%NODE_INSTALL%\npx.cmd" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\npx" copy "%NODE_INSTALL%\npx" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\corepack.cmd" copy "%NODE_INSTALL%\corepack.cmd" "%NODE_DIR%\" >nul 2>&1

    :: Copy node_modules for npm — use robocopy for deep paths
    echo  - Copying npm node_modules...
    if exist "%NODE_INSTALL%\node_modules" (
        robocopy "%NODE_INSTALL%\node_modules" "%NODE_DIR%\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
        if !errorlevel! geq 8 echo  [WARN] robocopy npm node_modules co loi
    )
) else (
    echo  [ERROR] Khong tim thay Node.js tai "%NODE_INSTALL%"
    echo  Hay dam bao Node.js da duoc cai dat.
    pause
    exit /b 1
)

:: ---- STEP 6: Create PM2 wrapper ----
echo.
echo  [6/6] Tao PM2 wrapper va launchers...
echo @echo off> "%DIST_DIR%\pm2.cmd"
echo setlocal>> "%DIST_DIR%\pm2.cmd"
echo set "SCRIPT_DIR=%%~dp0">> "%DIST_DIR%\pm2.cmd"
echo set "NODE_DIR=%%SCRIPT_DIR%%node_portable">> "%DIST_DIR%\pm2.cmd"
echo set "PM2_BIN=%%SCRIPT_DIR%%node_modules\pm2\bin\pm2">> "%DIST_DIR%\pm2.cmd"
echo set "PM2_HOME=%%SCRIPT_DIR%%.pm2">> "%DIST_DIR%\pm2.cmd"
echo set "PATH=%%NODE_DIR%%;%%PATH%%">> "%DIST_DIR%\pm2.cmd"
echo "%%NODE_DIR%%\node.exe" "%%PM2_BIN%%" %%*>> "%DIST_DIR%\pm2.cmd"
echo endlocal>> "%DIST_DIR%\pm2.cmd"

:: Copy TUI server.bat (replaces old start_server.bat + setup_server.bat)
echo  - Copying server.bat (TUI)...
copy "%SRC_DIR%server.bat" "%DIST_DIR%\server.bat" >nul 2>&1

:: Xu ly .env cho pack production
:: Xoa .env dev duoc copy tu robocopy, thay bang .env.production
del "%DIST_DIR%\server\.env" 2>nul
if exist "%SRC_DIR%server\.env.production" (
    copy "%SRC_DIR%server\.env.production" "%DIST_DIR%\server\.env" >nul 2>&1
    echo  [INFO] Da copy .env.production thanh .env cho server.
) else (
    echo DATABASE_URL="file:./app.db"> "%DIST_DIR%\server\.env"
    echo NODE_ENV=production>> "%DIST_DIR%\server\.env"
    echo PORT=3001>> "%DIST_DIR%\server\.env"
    echo JWT_SECRET=CHANGE_THIS_BEFORE_DEPLOY>> "%DIST_DIR%\server\.env"
    echo JWT_EXPIRES_IN=7d>> "%DIST_DIR%\server\.env"
    echo  [WARN] Da tao .env mac dinh. Nho doi JWT_SECRET truoc khi dung!
)

:: ---- DONE ----
echo.
echo  ================================================================
echo   [DONE] Dong goi Offline thanh cong!
echo.
echo   Thu muc goi:  %DIST_DIR%
echo.
echo   Checklist truoc khi deploy Production:
echo   [ ] Doi JWT_SECRET trong SERVER_PACKAGE\server\.env
echo   [ ] Kiem tra PORT (mac dinh: 3001)
echo.
echo   Huong dan trien khai:
 echo     1. Copy thu muc "SERVER_PACKAGE" sang USB/may doanh nghiep
 echo     2. Chay "server.bat" — chon [1] Setup lan dau
 echo        ^ se tu dong: tao .env / chay migrate deploy / seed
 echo     3. [3] Mo Firewall Port 3001
 echo     4. [5] Start PM2 — chay background 24/7
 echo     5. Mo trinh duyet: http://IP:3001
 echo     6. Vao Admin Panel — cau hinh Shared Paths tung may NAS
 echo     (Agent client_connect duoc dong goi rieng boi pack_client_connect_offline.bat)
echo  ================================================================
echo.

:: Show total size
echo  Kich thuoc goi:
dir "%DIST_DIR%" /s | findstr /i "File(s)"
echo.

:: Warn if .env has default JWT_SECRET
findstr /i "CHANGE_THIS_BEFORE_DEPLOY" "%DIST_DIR%\server\.env" >nul 2>&1
if !errorlevel! equ 0 (
    echo  ================================================================
    echo   [!!!] CANH BAO: JWT_SECRET van la gia tri mac dinh!
    echo         Hay doi JWT_SECRET trong: %DIST_DIR%\server\.env
    echo         truoc khi deploy len Production!
    echo  ================================================================
    echo.
)
pause
exit /b

