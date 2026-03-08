@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title NAS Manager ─ Server

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  ANSI escape character                                        ║
:: ╚══════════════════════════════════════════════════════════════╝
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

set "R=!ESC![0m"
set "BD=!ESC![1m"
set "CY=!ESC![96m"
set "BL=!ESC![94m"
set "WH=!ESC![97m"
set "YL=!ESC![93m"
set "GR=!ESC![92m"
set "RD=!ESC![91m"
set "GY=!ESC![90m"
set "MG=!ESC![35m"
set "BLD=!ESC![34m"

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  Paths                                                        ║
:: ╚══════════════════════════════════════════════════════════════╝
set "ROOT=%~dp0"
set "SRV=%ROOT%server\"

:: Node.js — ưu tiên node_portable
set "NODE_EXE="
if exist "%ROOT%node_portable\node.exe" (
    set "NODE_EXE=%ROOT%node_portable\node.exe"
    set "PATH=%ROOT%node_portable;%PATH%"
) else (
    where node >nul 2>&1
    if !errorlevel! equ 0 ( for /f "delims=" %%i in ('where node') do set "NODE_EXE=%%i" & goto NODE_OK )
)
:NODE_OK

:: PM2 — tìm trong root node_modules hoặc hệ thống
set "PM2_BIN="
set "PM2_IS_CMD="
if exist "%ROOT%node_modules\pm2\bin\pm2" (
    set "PM2_BIN=%ROOT%node_modules\pm2\bin\pm2"
) else if exist "%ROOT%pm2.cmd" (
    set "PM2_BIN=%ROOT%pm2.cmd"
    set "PM2_IS_CMD=1"
) else (
    where pm2 >nul 2>&1
    if !errorlevel! equ 0 ( for /f "delims=" %%i in ('where pm2') do set "PM2_BIN=%%i" & set "PM2_IS_CMD=1" )
)

:: Prisma — trong server/node_modules (uu tien .cmd hoac .js, KHONG dung .bin/prisma vi do la bash script)
set "PRISMA_BIN="
if exist "%SRV%node_modules\.bin\prisma.cmd"        set "PRISMA_BIN=%SRV%node_modules\.bin\prisma.cmd" & set "PRISMA_IS_CMD=1"
if exist "%SRV%node_modules\prisma\build\index.js"  set "PRISMA_BIN=%SRV%node_modules\prisma\build\index.js" & set "PRISMA_IS_CMD="

set "PM2_NAME=nas-server"
set "PORT=3001"
set "DB_FILE=%SRV%prisma\app.db"
set "LOG_OUT=%SRV%logs\server-out.log"
set "ECO_FILE=%ROOT%ecosystem.config.js"

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  MAIN LOOP                                                    ║
:: ╚══════════════════════════════════════════════════════════════╝
:MAIN
cls
call :FN_PM2_STATUS
call :FN_DB_STATUS
call :FN_NODE_INFO
call :FN_DRAW
choice /c 123456789WQ /n /m ""
set "K=%errorlevel%"
if "!K!"=="1"  goto ACT_SETUP
if "!K!"=="2"  goto ACT_MIGRATE
if "!K!"=="3"  goto ACT_FIREWALL
if "!K!"=="4"  goto ACT_RUN
if "!K!"=="5"  goto ACT_PM2_START
if "!K!"=="6"  goto ACT_PM2_STOP
if "!K!"=="7"  goto ACT_PM2_RESTART
if "!K!"=="8"  goto ACT_STATUS
if "!K!"=="9"  goto ACT_LOGS
if "!K!"=="10" goto ACT_STARTUP
if "!K!"=="11" goto ACT_EXIT
goto MAIN

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  DRAW UI                                                      ║
:: ╚══════════════════════════════════════════════════════════════╝
:FN_DRAW
echo.
echo  !BD!!CY!  ▌ NAS MANAGER  ─  SERVER  v2.0!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo   !GY!Status!R!   !STAT_CLR!!STAT_TXT!!R!    !GY!Port:!R! !WH!!PORT!!R!
echo   !GY!DB    !R!   !DB_CLR!!DB_TXT!!R!
echo   !GY!Node  !R!   !NODE_CLR!!NODE_TXT!!R!
echo.
echo  !MG! SETUP !R!              !MG! VAN HANH !R!
echo  !GY!──────────────────  ──────────────────────────────────!R!
echo   !YL![1]!R! !WH!Setup lan dau!R!    !YL![4]!R! !WH!Chay truc tiep!R! !GY!(foreground)!R!
echo   !YL![2]!R! !WH!Migrate DB!R!       !YL![5]!R! !WH!Start PM2!R!      !GY!(chay nen)!R!
echo   !YL![3]!R! !WH!Firewall!R!         !YL![6]!R! !WH!Stop PM2!R!
echo                        !YL![7]!R! !WH!Restart PM2!R!
echo.
echo  !MG! GIAM SAT !R!          !MG! HE THONG !R!
echo  !GY!──────────────────  ──────────────────────────────────!R!
echo   !YL![8]!R! !WH!Trang thai PM2!R!   !YL![W]!R! !WH!Windows Startup!R! !GY!(tu dong sau reboot)!R!
echo   !YL![9]!R! !WH!Logs PM2!R!         !GY!theo doi realtime!R!
echo.
echo  !GY!──────────────────────────────────────────────────────!R!
echo   !YL![Q]!R! !WH!Thoat!R!
echo.
echo  !GY!Nhan phim de chon !WH!(khong can Enter)!R!
exit /b

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  HELPERS                                                      ║
:: ╚══════════════════════════════════════════════════════════════╝
:FN_PM2_STATUS
set "STAT_TXT=○ OFFLINE    "
set "STAT_CLR=!GY!"
if "!NODE_EXE!"=="" goto :eof
if "!PM2_BIN!"=="" goto :eof
"!NODE_EXE!" "!PM2_BIN!" list 2>nul | findstr /i "!PM2_NAME!.*online" >nul 2>&1
if !errorlevel! equ 0 ( set "STAT_TXT=● ONLINE (PM2)" & set "STAT_CLR=!GR!" )
exit /b

:FN_DB_STATUS
if exist "!DB_FILE!" ( set "DB_TXT=server\prisma\app.db  ● Co san" & set "DB_CLR=!GR!" ) else ( set "DB_TXT=server\prisma\app.db  ○ Chua tao" & set "DB_CLR=!YL!" )
exit /b

:FN_NODE_INFO
if "!NODE_EXE!"=="" ( set "NODE_TXT=x Khong tim thay" & set "NODE_CLR=!RD!" ) else ( set "NODE_TXT=+ San sang" & set "NODE_CLR=!GR!" )
exit /b

:FN_PM2_CALL
if "!NODE_EXE!"=="" ( echo !RD![LOI] Khong tim thay Node.js!R! & pause & exit /b 1 )
if "!PM2_BIN!"=="" ( echo !RD![LOI] Khong tim thay PM2!R! & pause & exit /b 1 )
if defined PM2_IS_CMD ( call "!PM2_BIN!" %* ) else ( "!NODE_EXE!" "!PM2_BIN!" %* )
exit /b

:FN_PRISMA_CALL
if "!NODE_EXE!"=="" ( echo !RD![LOI] Khong tim thay Node.js!R! & exit /b 1 )
if "!PRISMA_BIN!"=="" ( echo !RD![LOI] Khong tim thay prisma!R! & exit /b 1 )
pushd "%SRV%"
if defined PRISMA_IS_CMD ( call "!PRISMA_BIN!" %* ) else ( "!NODE_EXE!" "!PRISMA_BIN!" %* )
set "_RC=%errorlevel%"
popd
exit /b !_RC!

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  ACTIONS                                                      ║
:: ╚══════════════════════════════════════════════════════════════╝
:ACT_SETUP
cls
echo.
echo  !BD!!CY!  SETUP — Cai dat lan dau!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo.
:: Kiem tra Node
call :FN_NODE_INFO
echo  !GY![1/4]!R! Node.js... !NODE_CLR!!NODE_TXT!!R!
if "!NODE_EXE!"=="" ( echo  !RD!Khong co Node.js!R! & pause & goto MAIN )

:: Kiem tra node_modules server
echo  !GY![2/4]!R! Kiem tra thu vien server...
if not exist "%SRV%node_modules\" ( echo  !RD!Thieu server\node_modules!R! & pause & goto MAIN )
echo         !GR!+ Co san!R!

:: Tat PM2 cloud/monitoring (offline)
echo  !GY![3/4]!R! Vo hieu hoa PM2 cloud...
if not exist "%USERPROFILE%\.pm2" mkdir "%USERPROFILE%\.pm2" >nul 2>&1
echo {} > "%USERPROFILE%\.pm2\agent.json5" 2>nul

:: Tao .env neu chua co
if not exist "%SRV%.env" (
    echo  !GY!Tao file .env tu ban mau...!R!
    if exist "%SRV%.env.production" (
        copy "%SRV%.env.production" "%SRV%.env" >nul 2>&1
        echo  !GR!  + Da tao .env tu .env.production!R!
    ) else if exist "%SRV%.env.example" (
        copy "%SRV%.env.example" "%SRV%.env" >nul 2>&1
        echo  !GR!  + Da tao .env tu .env.example!R!
    ) else (
        echo DATABASE_URL="file:./app.db"> "%SRV%.env"
        echo NODE_ENV=production>> "%SRV%.env"
        echo PORT=3001>> "%SRV%.env"
        echo JWT_SECRET=change_me_before_deploy>> "%SRV%.env"
        echo JWT_EXPIRES_IN=7d>> "%SRV%.env"
        echo  !YL!  + Da tao .env mac dinh (nho doi JWT_SECRET^)!R!
    )
)

:: Prisma migrate + seed
echo  !GY![4/4]!R! Khoi tao database...
if exist "!DB_FILE!" (
    echo  !YL![INFO] DB da ton tai — chay migrate deploy...!R!
    call :FN_PRISMA_CALL migrate deploy
) else (
    echo  !GY!Chay migrate deploy...!R!
    call :FN_PRISMA_CALL migrate deploy
)
if !errorlevel! neq 0 ( echo  !RD![LOI] Migrate that bai!R! & pause & goto MAIN )

:: Seed du lieu mau
echo  !GY!Seed du lieu mau...!R!
call :FN_PRISMA_CALL db seed
if !errorlevel! neq 0 echo  !YL![WARN] Seed that bai, co the bo qua.!R!

echo.
echo  !GR!  + Setup hoan tat!R!
pause & goto MAIN

:ACT_MIGRATE
cls
echo.
echo  !BD!!CY!  MIGRATE DATABASE!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo.
echo  !GY!Tuy chon migrate:!R!
echo   !YL![1]!R! migrate deploy  !GY!production — dung migration files co san!R!
echo   !YL![2]!R! migrate dev     !GY!development — tao migration moi!R!
echo   !YL![3]!R! Quay lai
echo.
choice /c 123 /n /m "  > "
if !errorlevel!==1 (
    call :FN_PRISMA_CALL migrate deploy
    if !errorlevel! equ 0 ( echo  !GR!+ Migrate deploy thanh cong!R! ) else ( echo  !RD!x That bai!R! )
)
if !errorlevel!==2 (
    call :FN_PRISMA_CALL migrate dev
    if !errorlevel! equ 0 ( echo  !GR!+ Migrate dev thanh cong!R! ) else ( echo  !RD!x That bai!R! )
)
if !errorlevel!==3 goto MAIN
pause & goto MAIN

:ACT_FIREWALL
cls
echo.
echo  !BD!!CY!  CAU HINH FIREWALL!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo.
:: Kiem tra quyen admin
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo  !RD![LOI] Can quyen Administrator!R!
    echo  !GY!Click phai server.bat — Run as administrator!R!
    pause & goto MAIN
)
echo  !GY!Them rule Firewall cho Port 3001 va 5173...!R!
netsh advfirewall firewall add rule name="NAS Manager Server 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
netsh advfirewall firewall add rule name="NAS Manager Server 3001 OUT" dir=out action=allow protocol=TCP localport=3001 >nul 2>&1
netsh advfirewall firewall add rule name="NAS Manager Client 5173" dir=in action=allow protocol=TCP localport=5173 >nul 2>&1
echo  !GR!  + Da them Firewall rules cho port 3001 va 5173!R!
pause & goto MAIN

:ACT_RUN
cls
if "!NODE_EXE!"=="" ( echo  !RD![LOI] Khong tim thay Node.js!R! & pause & goto MAIN )
echo  !YL!Chay truc tiep — Ctrl+C de dung!R!
echo.
set "NODE_ENV=production"
cd /d "%SRV%"
"!NODE_EXE!" index.js
pause
cd /d "%ROOT%"
goto MAIN

:ACT_PM2_START
cls
if "!NODE_EXE!"=="" ( echo  !RD![LOI] Khong tim thay Node.js!R! & pause & goto MAIN )
echo  !GY!Dang start PM2...!R!
if exist "!ECO_FILE!" (
    echo  !GY!Dung ecosystem.config.js...!R!
    call :FN_PM2_CALL start "!ECO_FILE!" --only !PM2_NAME!
) else (
    call :FN_PM2_CALL start "%SRV%index.js" --name !PM2_NAME! --env production --log "%SRV%logs\server-out.log" --error "%SRV%logs\server-error.log"
)
if !errorlevel! equ 0 ( echo  !GR!  + Da start PM2: !PM2_NAME!!R! ) else ( echo  !RD!  x Start that bai!R! )
call :FN_PM2_CALL save >nul 2>&1
pause & goto MAIN

:ACT_PM2_STOP
cls
echo  !GY!Dang stop PM2...!R!
call :FN_PM2_CALL stop !PM2_NAME!
echo  !GR!  + Da stop: !PM2_NAME!!R!
pause & goto MAIN

:ACT_PM2_RESTART
cls
echo  !GY!Dang restart PM2...!R!
call :FN_PM2_CALL restart !PM2_NAME!
echo  !GR!  + Da restart: !PM2_NAME!!R!
pause & goto MAIN

:ACT_STATUS
cls
call :FN_PM2_CALL status !PM2_NAME!
echo.
pause & goto MAIN

:ACT_LOGS
cls
echo  !YL!PM2 Logs — Ctrl+C de thoat!R!
echo.
call :FN_PM2_CALL logs !PM2_NAME! --lines 50
pause & goto MAIN

:ACT_STARTUP
cls
echo.
echo  !BD!!CY!  WINDOWS STARTUP — Tu dong khoi dong khi reboot!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo.
echo  !GY!Can quyen Administrator de cai dat Scheduled Task.!R!
echo.
:: Kiem tra quyen admin
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo  !RD![LOI] Can quyen Administrator!!R!
    echo  !GY!Click phai server.bat — Run as administrator.!R!
    pause & goto MAIN
)
echo  Tuy chon:
echo   !YL![1]!R! Bat tu dong khoi dong (Enable)
echo   !YL![2]!R! Tat tu dong khoi dong (Disable)
echo   !YL![3]!R! Quay lai
echo.
choice /c 123 /n /m "  Chon > "
set "S=%errorlevel%"
if "!S!"=="1" (
    echo.
    echo  !GY!Buoc 1: Luu danh sach PM2 hien tai...!R!
    call :FN_PM2_CALL save
    echo.
    echo  !GY!Buoc 2: Cai PM2 Windows Startup...!R!
    call :FN_PM2_CALL startup windows
    if !errorlevel! equ 0 (
        echo.
        echo  !GR!  + Da BAT thiet lap Startup thanh cong!!R!
        echo  !WH!  PM2 se tu dong khoi dong cung Windows.!R!
    ) else (
        echo  !RD!  x Thiet lap that bai. Thu chay lai quyen Admin.!R!
    )
    echo.
    pause & goto MAIN
)
if "!S!"=="2" (
    echo.
    echo  !GY!Dang xoa (Uninstall) thiet lap Windows Startup...!R!
    call :FN_PM2_CALL unstartup windows
    if !errorlevel! equ 0 (
        echo.
        echo  !GR!  + Da TAT Windows Startup!!R!
    ) else (
        echo  !RD!  x Tat that bai. Thu chay lai quyen Admin.!R!
    )
    echo.
    pause & goto MAIN
)
goto MAIN

:ACT_EXIT
echo  !GY!Thoat.!R!
endlocal
exit /b 0



