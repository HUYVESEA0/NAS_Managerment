@echo off
setlocal EnableDelayedExpansion
title NAS Manager — Setup

cls
echo.
echo  ================================================
echo       NAS MANAGER v1.0-beta — SETUP WIZARD
echo  ================================================
echo.

:: ---- 1. Server ----
echo  [1/4] Cai dat Server dependencies...
cd server
call npm install
if !errorlevel! neq 0 goto ERROR
call npm run build
if !errorlevel! neq 0 goto ERROR

echo.
echo  [2/4] Khoi tao Database...
if not exist "prisma\dev.db" (
    echo  Tao database moi...
    call npx prisma migrate dev --name init
    echo  Seeding du lieu mac dinh...
    call npx prisma db seed
) else (
    echo  Cap nhat schema...
    call npx prisma generate
    call npx prisma migrate deploy
)
cd ..

:: ---- 2. Client ----
echo.
echo  [3/4] Cai dat Client dependencies...
cd client
call npm install
if !errorlevel! neq 0 goto ERROR
cd ..

:: ---- 3. Client Connect (Agent) ----
echo.
echo  [4/4] Cai dat Client Connect dependencies...
cd client_connect
call npm install
if !errorlevel! neq 0 goto ERROR
cd ..

:: ---- Done ----
echo.
echo  ================================================
echo   [DONE] Cai dat hoan tat!
echo.
echo   De chay app:
echo     - Dev:  chon [1] trong start_app.bat
echo     - Prod: chon [2] trong start_app.bat
echo.
echo   Chay 'start_app.bat' de bat dau.
echo  ================================================
pause
exit /b

:ERROR
echo.
echo  [ERROR] Co loi xay ra. Kiem tra ket noi mang / npm.
cd %~dp0
pause
exit /b 1
