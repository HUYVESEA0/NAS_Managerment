@echo off
setlocal
title NAS Manager - Ngat Ket Noi

echo.
echo  ================================================
echo      NAS MANAGER - NGAT KET NOI
echo  ================================================
echo.

echo  [INFO] Dang ngat ket noi...
wmic process where "name='node.exe' and commandline like '%%agent.js%%'" call terminate >nul 2>&1

if %errorlevel% equ 0 (
    echo  [OK] Da ngat ket noi thanh cong.
) else (
    echo  [WARN] Khong tim thay tien trinh dang chay.
)

echo.
pause
