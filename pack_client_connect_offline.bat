@echo off
setlocal EnableDelayedExpansion
title NASHub — Client Connect Package Builder

cls
echo.
echo  ================================================================
echo    NASHUB — CLIENT CONNECT PACKAGE BUILDER
echo  ================================================================
echo    Tao goi cai dat Offline cho cac may NAS (Agent).
echo    Yeu cau: May nay phai co internet va da cai dependencies.
echo  ================================================================
echo.

:: ---- CONFIG ----
set "SRC_DIR=%~dp0"
set "DIST_DIR=%~dp0CLIENT_CONNECT_PACKAGE"
set "NODE_DIR=%DIST_DIR%\node_portable"

:: ---- STEP 0: Clean old package ----
if not exist "%DIST_DIR%" goto :SKIP_CLEAN
echo  [WARN] Thu muc CLIENT_CONNECT_PACKAGE da ton tai.
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
mkdir "%DIST_DIR%\logs" 2>nul

:: ---- STEP 1: Ensure Agent & PM2 dependencies are installed ----
echo.
echo  [1/4] Kiem tra va cai dat dependencies...

echo  - Root (PM2)...
cd /d "%SRC_DIR%"
call npm install --prefer-offline
if !errorlevel! neq 0 echo  [WARN] Root npm install co loi, tiep tuc...

echo  - Client Connect (Agent)...
cd /d "%SRC_DIR%client_connect"
call npm install --prefer-offline
if !errorlevel! neq 0 echo  [WARN] Agent npm install co loi, tiep tuc...

cd /d "%SRC_DIR%"

:: ---- STEP 2: Copy project files ----
echo.
echo  [2/4] Copy ma nguon va dependencies...

:: Client Connect (with node_modules) — robocopy xu ly deep paths tot hon xcopy
echo  - Copying client_connect...
robocopy "%SRC_DIR%client_connect" "%DIST_DIR%\client_connect" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
if !errorlevel! geq 8 echo  [WARN] robocopy client_connect co loi (errorlevel !errorlevel!)

:: Root node_modules: chi copy pm2 (nhe hon copy ca root)
echo  - Copying pm2...
mkdir "%DIST_DIR%\node_modules" 2>nul
robocopy "%SRC_DIR%node_modules\pm2" "%DIST_DIR%\node_modules\pm2" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
if !errorlevel! geq 8 echo  [WARN] robocopy pm2 co loi

:: ---- STEP 3: Bundle Node.js Portable ----
echo.
echo  [3/4] Tao Node.js Portable...
mkdir "%NODE_DIR%" 2>nul

set "NODE_INSTALL=C:\Program Files\nodejs"
if exist "%NODE_INSTALL%\node.exe" (
    echo  - Copying node.exe...
    copy "%NODE_INSTALL%\node.exe" "%NODE_DIR%\" >nul 2>&1
    
    echo  - Copying npm...
    if exist "%NODE_INSTALL%\npm.cmd" copy "%NODE_INSTALL%\npm.cmd" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\npm" copy "%NODE_INSTALL%\npm" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\npx.cmd" copy "%NODE_INSTALL%\npx.cmd" "%NODE_DIR%\" >nul 2>&1
    if exist "%NODE_INSTALL%\npx" copy "%NODE_INSTALL%\npx" "%NODE_DIR%\" >nul 2>&1
    
    echo  - Copying node_modules...
    robocopy "%NODE_INSTALL%\node_modules" "%NODE_DIR%\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
    if !errorlevel! geq 8 echo  [WARN] robocopy node_modules co loi
) else (
    echo  [ERROR] Khong tim thay Node.js tai "%NODE_INSTALL%"
    echo  Hay dam bao Node.js da duoc cai dat tren may tinh nay.
    pause
    exit /b 1
)

:: ---- STEP 4: Create scripts wrapper ----
echo.
echo  [4/4] Tao script khoi dong...

:: PM2 wrapper
echo @echo off> "%DIST_DIR%\pm2.cmd"
echo setlocal>> "%DIST_DIR%\pm2.cmd"
echo set "SCRIPT_DIR=%%~dp0">> "%DIST_DIR%\pm2.cmd"
echo set "NODE_DIR=%%SCRIPT_DIR%%node_portable">> "%DIST_DIR%\pm2.cmd"
echo set "PM2_BIN=%%SCRIPT_DIR%%node_modules\pm2\bin\pm2">> "%DIST_DIR%\pm2.cmd"
echo set "PATH=%%NODE_DIR%%;%%PATH%%">> "%DIST_DIR%\pm2.cmd"
echo "%%NODE_DIR%%\node.exe" "%%PM2_BIN%%" %%*>> "%DIST_DIR%\pm2.cmd"
echo endlocal>> "%DIST_DIR%\pm2.cmd"

:: Tao client_connect.bat o root — redirect vao client_connect/ (vi paths trong bat dung %~dp0)
echo  - Tao client_connect.bat...
echo @echo off> "%DIST_DIR%\client_connect.bat"
echo cd /d "%%~dp0client_connect">> "%DIST_DIR%\client_connect.bat"
echo call "%%~dp0client_connect\client_connect.bat">> "%DIST_DIR%\client_connect.bat"

:: ---- STEP 5: DONE ----
echo.
echo  ================================================================
echo   [DONE] Dong goi CLIENT CONNECT Package thanh cong!
echo.
echo   Thu muc goi:  %DIST_DIR%
echo.
echo   Huong dan trien khai tren may NAS con:
echo     1. Copy thu muc "CLIENT_CONNECT_PACKAGE" sang USB/HDD
echo     2. Mang sang may NAS con (VD: C:\NAS_Client)
echo     3. Chay "client_connect.bat"  -  chon [1] Setup truoc, sau do [4] Start PM2
echo     4. Shared Paths cau hinh tu Admin Panel tren Server (tu dong push xuong agent)
echo     NOTE: Agent tu dong nhan gioi han thu muc khi Server push Shared Paths
echo  ================================================================
echo.
pause
exit /b
