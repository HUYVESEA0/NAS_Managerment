@echo off
setlocal EnableDelayedExpansion
title NAS Manager System

:MENU
cls
echo.
echo  ================================================
echo       NAS MANAGER v1.0-beta — LAUNCHER
echo  ================================================
echo.
echo   [1] Development Mode   (Server + Client rieng le)
echo   [2] Production Mode    (Build + Chay 1 tien trinh)
echo   [3] Chi chay Server    (Backend API only)
echo   [4] Chi chay Client    (Frontend Dev only)
echo   [5] Setup / Install    (Cai dat lan dau)
echo   [0] Thoat
echo.
set /p choice=  Chon (0-5): 

if "!choice!"=="1" goto DEV
if "!choice!"=="2" goto PROD
if "!choice!"=="3" goto SERVER_ONLY
if "!choice!"=="4" goto CLIENT_ONLY
if "!choice!"=="5" goto SETUP
if "!choice!"=="0" exit
goto MENU

:: ============================================
:DEV
:: ============================================
cls
echo.
echo  [DEV] Starting Development Mode...
echo  Server: http://localhost:3001
echo  Client: http://localhost:5173
echo.

start "NAS Backend (Dev)" cmd /k "cd server && npm run dev"
timeout /t 2 >nul
start "NAS Frontend (Dev)" cmd /k "cd client && npm run dev"
timeout /t 4 >nul
start http://localhost:5173
goto END

:: ============================================
:PROD
:: ============================================
cls
echo.
echo  [PROD] Production Mode
echo  ================================================
echo.

:: Check if client/dist exists
if not exist "client\dist\" (
    echo  [BUILD] Khong tim thay ban build. Dang build Client...
    echo.
    cd client
    call npm run build
    if !errorlevel! neq 0 (
        echo  [ERROR] Build that bai!
        pause
        cd ..
        goto MENU
    )
    cd ..
    echo  [BUILD] Build thanh cong!
    echo.
) else (
    echo  [INFO] Ban build ton tai. Dung 'Rebuild' de cap nhat.
    echo.
    set /p rebuildchoice=  Rebuild client? (Y/N, Enter=N): 
    if /i "!rebuildchoice!"=="Y" (
        cd client
        call npm run build
        cd ..
    )
)

:: Start Agent hidden
echo  [AGENT] Khoi dong Local Agent (ngam)...
powershell -Command "Start-Process node -ArgumentList 'agent.js' -WorkingDirectory '%~dp0agent' -WindowStyle Hidden" >nul 2>&1

:: Start Server in Production
echo  [SERVER] Khoi dong Production Server...
echo  Web UI + API: http://localhost:3001
echo.

start "NAS Manager" cmd /k "cd server && npm run start:prod"
timeout /t 3 >nul

:: Open browser
start http://localhost:3001
goto END

:: ============================================
:SERVER_ONLY
:: ============================================
echo.
echo  [SERVER] Starting Backend Server (port 3001)...
start "NAS Backend" cmd /k "cd server && npm run dev"
goto END

:: ============================================
:CLIENT_ONLY
:: ============================================
echo.
echo  [CLIENT] Starting Frontend Client (port 5173)...
start "NAS Frontend" cmd /k "cd client && npm run dev"
goto END

:: ============================================
:SETUP
:: ============================================
call setup_app.bat
goto MENU

:: ============================================
:END
:: ============================================
echo.
echo  ================================================
echo   Services launched!
echo   Web UI:    http://localhost:5173  (Dev)
echo              http://localhost:3001  (Prod)
echo   API:       http://localhost:3001/api
echo   Health:    http://localhost:3001/health
echo  ================================================
echo.
pause
