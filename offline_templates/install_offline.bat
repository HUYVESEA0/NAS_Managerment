@echo off
setlocal EnableDelayedExpansion
title NAS Manager — Offline Installer

:: Get network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "NET_IP=%%a"
    set "NET_IP=!NET_IP: =!"
    goto :GOT_IP
)
:GOT_IP
if not defined NET_IP set "NET_IP=localhost"

cls
echo.
echo  ================================================================
echo    NAS MANAGER — OFFLINE INSTALLER
echo  ================================================================
echo    Cai dat he thong tu goi Offline (KHONG internet).
echo    IP may nay: !NET_IP!
echo  ================================================================
echo.

set "APP_DIR=%~dp0"

:: ---- Call TUI bat ----
echo  [*] Mo giao dien quan ly server...
if exist "%APP_DIR%server.bat" (
    call "%APP_DIR%server.bat"
) else (
    echo  [ERROR] Khong tim thay server.bat!
    pause
    exit /b 1
)

if %errorlevel% neq 0 (
    echo  [ERROR] Co loi trong qua trinh setup. Vui long kiem tra lai.
    pause
    exit /b 1
)

:: ---- Add to System PATH (optional) ----
echo.
echo  [PATHS] Tao shortcut va PATH...
set "NODE_DIR=%APP_DIR%node_portable"
set /p addpath=  Them Node.js vao System PATH? (y/N): 
if /i "%addpath%"=="y" (
    setx PATH "%NODE_DIR%;%APP_DIR%;%PATH%" /M 2>nul
    if %errorlevel% equ 0 (
        echo  [OK] Da them vao System PATH.
    ) else (
        echo  [WARN] Can quyen Administrator de them PATH.
    )
)

:: ---- Done ----
cls
echo.
echo  ================================================================
echo   [DONE] Cai dat Offline hoan tat!
echo.
echo   Cach su dung:
 echo     - Chay "server.bat" de quan ly dich vu
echo     - Mo trinh duyet: http://!NET_IP!:3001
echo  ================================================================
echo.
pause
