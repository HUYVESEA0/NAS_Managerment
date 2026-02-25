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
echo   [6] Kill Node          (Sua loi address already in use)
echo   [7] PM2 Manager        (Chay ngam, tu khoi dong)
echo   [0] Thoat
echo.
set /p choice=  Chon (0-6): 

if "!choice!"=="1" goto DEV
if "!choice!"=="2" goto PROD
if "!choice!"=="3" goto SERVER_ONLY
if "!choice!"=="4" goto CLIENT_ONLY
if "!choice!"=="5" goto SETUP
if "!choice!"=="6" goto KILL_NODE
if "!choice!"=="7" goto PM2_MANAGER
if "!choice!"=="0" exit
goto MENU

:: ============================================
:PM2_MANAGER
:: ============================================
call run_pm2.bat
goto MENU

:: ============================================
:DEV
:: ============================================
cls
echo.
echo  [DEV] Starting Development Mode...
echo  (Dang dung cac tien trinh cu de tranh loi Port...)
taskkill /F /IM node.exe >nul 2>&1

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
echo  [PROD] Mode San pham (Production)
echo  ================================================
echo  (Dang dung cac tien trinh cu de tranh loi Port...)
taskkill /F /IM node.exe >nul 2>&1
echo.

:: Check if client/dist exists
if not exist "client\dist\" (
    echo  [BUILD] Khong tim thay ban build. Dang build Client...
    echo.
    cd client
    call npm run build
    cd ..
) else (
    echo  [INFO] Ban build hien tai da san sang.
    set /p rebuildchoice=  Rebuild lai Client? (y/N): 
    if /i "!rebuildchoice!"=="y" (
        cd client
        call npm run build
        cd ..
    )
)

:: Start Local Agent
echo.
echo  [AGENT] Khoi dong Local Agent...
start "NAS Agent (Local)" cmd /c "cd client_connect && node agent.js"

:: Start Server in Production
echo.
echo  [SERVER] Khoi dong Production Server...
echo  Web UI + API: http://localhost:3001
echo.

start "NAS Manager (Prod)" cmd /k "cd server && npm run start:prod"
timeout /t 5 >nul

:: Open browser
start http://localhost:3001
goto END

:: ============================================
:SERVER_ONLY
:: ============================================
echo.
echo  (Dang dung cac tien trinh cu de tranh loi Port...)
taskkill /F /IM node.exe >nul 2>&1
echo  [SERVER] Starting Backend Server (port 3001)...
start "NAS Backend" cmd /k "cd server && npm run dev"
goto END

:: ============================================
:CLIENT_ONLY
:: ============================================
echo.
echo  (Dang dung cac tien trinh cu de tranh loi Port...)
taskkill /F /IM node.exe >nul 2>&1
echo  [CLIENT] Starting Frontend Client (port 5173)...
start "NAS Frontend" cmd /k "cd client && npm run dev"
goto END

:: ============================================
:SETUP
:: ============================================
call setup_app.bat
goto MENU

:: ============================================
:KILL_NODE
:: ============================================
cls
echo.
echo  [KILL] Dang tat cac tien trinh Node.js chay ngam...
taskkill /F /IM node.exe >nul 2>&1
echo  [DONE] Da don dep. Port 3001, 5173 da duoc tra lai.
echo.
pause
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
