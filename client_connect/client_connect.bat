@echo off
:: ── Crash protection: keep CMD open if script errors ──
if not "%~1"=="--inner" (
    cmd /k call "%~f0" --inner
    exit /b
)
shift
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title NAS Manager ─ Client Connect

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
set "APP=%~dp0"
set "ROOT=%APP%..\"

:: Node.js — ưu tiên node_portable bên cạnh
set "NODE_EXE="
if exist "%ROOT%node_portable\node.exe" (
    set "NODE_EXE=%ROOT%node_portable\node.exe"
    set "PATH=%ROOT%node_portable;%PATH%"
) else if exist "%APP%node_portable\node.exe" (
    set "NODE_EXE=%APP%node_portable\node.exe"
    set "PATH=%APP%node_portable;%PATH%"
) else (
    for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
)

:: PM2 — tìm pm2 trong root node_modules hoặc hệ thống
set "PM2_BIN="
if exist "%ROOT%node_modules\pm2\bin\pm2" (
    set "PM2_BIN=%ROOT%node_modules\pm2\bin\pm2"
) else if exist "%APP%node_modules\pm2\bin\pm2" (
    set "PM2_BIN=%APP%node_modules\pm2\bin\pm2"
) else if exist "%ROOT%pm2.cmd" (
    set "PM2_BIN=%ROOT%pm2.cmd"
    set "PM2_IS_CMD=1"
)

set "CFG=%APP%client_connect.config.json"
set "LOG_OUT=%APP%logs\client-connect-out.log"
set "LOG_ERR=%APP%logs\client-connect-error.log"
set "PM2_NAME=nas-client-connect"

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  MAIN LOOP                                                    ║
:: ╚══════════════════════════════════════════════════════════════╝
:MAIN
cls
call :FN_READ_CFG
call :FN_PM2_STATUS
call :FN_NODE_INFO
call :FN_DRAW
choice /c 123456789WQ /n /m ""
set "K=%errorlevel%"
if "!K!"=="1"  goto ACT_SETUP
if "!K!"=="2"  goto ACT_EDIT
if "!K!"=="3"  goto ACT_RUN
if "!K!"=="4"  goto ACT_PM2_START
if "!K!"=="5"  goto ACT_PM2_STOP
if "!K!"=="6"  goto ACT_PM2_RESTART
if "!K!"=="7"  goto ACT_STATUS
if "!K!"=="8"  goto ACT_LOGS
if "!K!"=="9"  goto ACT_LOGFILE
if "!K!"=="10" goto ACT_STARTUP
if "!K!"=="11" goto ACT_EXIT
goto MAIN

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  DRAW UI                                                      ║
:: ╚══════════════════════════════════════════════════════════════╝
:FN_DRAW
echo.
echo  !BD!!CY!  ▌ NAS MANAGER  ─  CLIENT CONNECT  v2.0!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo   !GY!Status!R!   !STAT_CLR!!STAT_TXT!!R!    !GY!Machine ID:!R! !WH!!CFG_ID!!R!
echo   !GY!Server!R!   !GY!!CFG_SRV!!R!
echo   !GY!Node  !R!   !NODE_CLR!!NODE_TXT!!R!
echo.
echo  !MG! SETUP !R!              !MG! VAN HANH !R!
echo  !GY!──────────────────  ──────────────────────────────────!R!
echo   !YL![1]!R! !WH!Setup!R!            !YL![3]!R! !WH!Chay truc tiep!R! !GY!(foreground)!R!
echo   !YL![2]!R! !WH!Sua config!R!       !YL![4]!R! !WH!Start PM2!R!      !GY!(chay nen)!R!
echo                        !YL![5]!R! !WH!Stop PM2!R!
echo                        !YL![6]!R! !WH!Restart PM2!R!
echo.
echo  !MG! GIAM SAT !R!          !MG! HE THONG !R!
echo  !GY!──────────────────  ──────────────────────────────────!R!
echo   !YL![7]!R! !WH!Trang thai PM2!R!   !YL![W]!R! !WH!Windows Startup!R! !GY!(tu dong sau reboot)!R!
echo   !YL![8]!R! !WH!Logs PM2!R!         !GY!theo doi realtime!R!
echo   !YL![9]!R! !WH!Xem file log!R!     !GY!logs/client-connect-out.log!R!
echo.
echo  !GY!──────────────────────────────────────────────────────!R!
echo   !YL![Q]!R! !WH!Thoat!R!
echo.
echo  !GY!Nhan phim de chon !WH!(khong can Enter)!R!
exit /b

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  HELPERS                                                      ║
:: ╚══════════════════════════════════════════════════════════════╝
:FN_READ_CFG
set "CFG_SRV=Chưa cấu hình"
set "CFG_ID=-"
if not exist "!CFG!" exit /b
if "!NODE_EXE!"=="" exit /b
setlocal DisableDelayedExpansion
set "_JSTMP=%TEMP%\_nas_read_cfg.js"
>"%_JSTMP%" echo try{var c=JSON.parse^(require^('fs'^).readFileSync^(process.argv[2],'utf8'^)^);console.log^(c.server^|^|'N/A'^);console.log^(c.machineId^|^|'-'^)}catch^(e^){console.log^('N/A'^);console.log^('-'^)}
endlocal
set "_CC_I=0"
for /f "usebackq delims=" %%i in (`"!NODE_EXE!" "%_JSTMP%" "!CFG!" 2^>nul`) do (
    set /a "_CC_I+=1"
    if !_CC_I! equ 1 set "CFG_SRV=%%i"
    if !_CC_I! equ 2 set "CFG_ID=%%i"
)
exit /b

:FN_PM2_STATUS
set "STAT_TXT=○ OFFLINE    "
set "STAT_CLR=!GY!"
set "CC_ONLINE=0"
if "!NODE_EXE!"=="" exit /b
if "!PM2_BIN!"=="" exit /b
"!NODE_EXE!" "!PM2_BIN!" list 2>nul | findstr /i "!PM2_NAME!.*online" >nul 2>&1
if !errorlevel! equ 0 ( set "STAT_TXT=● ONLINE (PM2)" & set "STAT_CLR=!GR!" & set "CC_ONLINE=1" )
exit /b

:FN_NODE_INFO
if "!NODE_EXE!"=="" ( set "NODE_TXT=✗ Không tìm thấy" & set "NODE_CLR=!RD!" ) else ( set "NODE_TXT=✓ Sẵn sàng" & set "NODE_CLR=!GR!" )
exit /b

:FN_PM2_CALL
if "!NODE_EXE!"=="" ( echo !RD![LỖI] Không tìm thấy Node.js!R! & pause & exit /b 1 )
if "!PM2_BIN!"=="" ( echo !RD![LỖI] Không tìm thấy PM2!R! & pause & exit /b 1 )
if defined PM2_IS_CMD ( call "!PM2_BIN!" %* ) else ( "!NODE_EXE!" "!PM2_BIN!" %* )
exit /b

:: ╔══════════════════════════════════════════════════════════════╗
:: ║  ACTIONS                                                      ║
:: ╚══════════════════════════════════════════════════════════════╝
:ACT_SETUP
cls
echo !BLD!╔══════════════════════════════════════════════════════════╗!R!
echo !BLD!║!CY!!BD!  SETUP — Cấu hình kết nối                          !R!!BLD!║!R!
echo !BLD!╚══════════════════════════════════════════════════════════╝!R!
echo.
:: 1. Kiểm tra Node.js
call :FN_NODE_INFO
echo  !GY![1/3]!R! Node.js... !NODE_CLR!!NODE_TXT!!R!
if "!NODE_EXE!"=="" (
    echo  !RD!Không có Node.js. Đặt file node-vXX.X.X-x64.msi vào:!R!
    echo  !WH!  %APP%installers\!R!
    :: Thử MSI installer
    set "MSI="
    for %%F in ("%APP%installers\node*.msi") do if exist "%%F" set "MSI=%%F"
    if not "!MSI!"=="" (
        echo  !YL![AUTO] Tìm thấy bộ cài: !MSI!!R!
        start /wait msiexec /i "!MSI!" /qb ADDLOCAL=NodeRuntime
        echo  !GR!Cài xong. Vui lòng ĐÓNG và CHẠY LẠI.!R!
        pause & exit /b
    )
    pause & goto MAIN
)
:: 2. Kiểm tra node_modules
echo  !GY![2/3]!R! Thư viện...
if not exist "%APP%node_modules\" ( echo  !RD!Thiếu node_modules! Cần có sẵn trong gói cài đặt.!R! & pause & goto MAIN )
echo  !GR!  ✓ Có sẵn!R!
:: 3. Nhập thông tin
echo  !GY![3/3]!R! Thông tin kết nối
echo.
if exist "!CFG!" (
    echo  !YL![INFO] Cấu hình hiện tại: !CFG_SRV! ^(ID:!CFG_ID!^)!R!
    set /p "RECONF=  Setup lại? !GY!(Y/N)!R! : "
    if /i "!RECONF!" neq "Y" goto MAIN
)
echo.
set /p "SRV_IP=  !WH!IP Server!R! !GY!(vd: 192.168.1.100)!R! : "
if "!SRV_IP!"=="" ( echo  !RD!IP không được để trống!!R! & pause & goto MAIN )
set /p "MC_ID=  !WH!Machine ID!R! !GY!(xem trong Dashboard)!R!  : "
if "!MC_ID!"=="" ( echo  !RD!Machine ID không được để trống!!R! & pause & goto MAIN )
echo.
echo  !GY!Đang kết nối...!R!
cd /d "%APP%"
"!NODE_EXE!" client_connect.js --setup --server ws://!SRV_IP!:3001/ws/agent --machine-id !MC_ID!
if !errorlevel! neq 0 ( echo  !RD![LỖI] Setup thất bại!!R! & pause & goto MAIN )
echo  !GR!  ✓ Cấu hình hoàn tất!!R!
pause
goto MAIN

:ACT_EDIT
if not exist "!CFG!" ( echo  !RD!Chưa có cấu hình. Chạy [1] Setup trước!!R! & timeout /t 2 & goto MAIN )
notepad "!CFG!"
goto MAIN

:ACT_RUN
cls
if "!NODE_EXE!"=="" ( echo  !RD![LỖI] Không tìm thấy Node.js!!R! & pause & goto MAIN )
echo  !YL!Chạy trực tiếp (Ctrl+C để dừng)!R!
echo.
cd /d "%APP%"
"!NODE_EXE!" client_connect.js
pause
goto MAIN

:ACT_PM2_START
cls
if not exist "!CFG!" ( echo  !RD![LOI] Chua cau hinh! Chay [1] Setup truoc!!R! & pause & goto MAIN )
echo  !GY!Dang start PM2...!R!
:: --cwd dam bao PM2 luon chay dung thu muc khi tu khoi dong lai sau reboot
call :FN_PM2_CALL start "%APP%client_connect.js" --name !PM2_NAME! --cwd "%APP%" --log "%APP%logs\client-connect-out.log" --error "%APP%logs\client-connect-error.log"
if !errorlevel! equ 0 ( echo  !GR!  + Da start PM2: !PM2_NAME!!R! ) else ( echo  !RD!  x Start that bai!R! )
call :FN_PM2_CALL save >nul 2>&1
pause & goto MAIN

:ACT_PM2_STOP
cls
echo  !GY!Đang stop PM2...!R!
call :FN_PM2_CALL stop !PM2_NAME!
echo  !GR!  ✓ Đã stop: !PM2_NAME!!R!
pause & goto MAIN

:ACT_PM2_RESTART
cls
echo  !GY!Đang restart PM2...!R!
call :FN_PM2_CALL restart !PM2_NAME!
echo  !GR!  ✓ Đã restart: !PM2_NAME!!R!
pause & goto MAIN

:ACT_STATUS
cls
call :FN_PM2_CALL status !PM2_NAME!
echo.
pause & goto MAIN

:ACT_LOGS
cls
echo  !YL!PM2 Logs — Ctrl+C để thoát!R!
echo.
call :FN_PM2_CALL logs !PM2_NAME! --lines 50
pause & goto MAIN

:ACT_LOGFILE
cls
if not exist "!LOG_OUT!" ( echo  !GY!Chua co file log.!R! & pause & goto MAIN )
echo  !GY!Xem file: !LOG_OUT!!R!
echo  !GY!━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━!R!
type "!LOG_OUT!" | more
pause & goto MAIN

:ACT_STARTUP
cls
echo.
echo  !BD!!CY!  WINDOWS STARTUP — Tu dong khoi dong khi reboot!R!
echo  !GY!──────────────────────────────────────────────────────!R!
echo.
echo  !GY!Can quyen Administrator de cai dat Scheduled Task.!R!
echo.
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo  !RD![LOI] Can quyen Administrator!!R!
    echo  !GY!Click phai client_connect.bat — Run as administrator.!R!
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
    echo  !GY!Buoc 2: Cai dat PM2 Windows Startup...!R!
    call :FN_PM2_CALL startup windows
    if !errorlevel! equ 0 (
        echo.
        echo  !GR!  + Da BAT thiet lap Startup thanh cong!!R!
        echo  !WH!  PM2 se tu dong khoi dong cung Windows.!R!
        echo  !GY!  Agent se tu ket noi lai voi Server sau reboot.!R!
    ) else (
        echo  !RD!  x Thiet lap that bai. Thu chay lai quyen Admin.!R!
    )
    echo.
    pause & goto MAIN
)
if "!S!"=="2" (
    echo.
    echo  !GY!Dang xoa ^(Uninstall^) thiet lap Windows Startup...!R!
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
exit
