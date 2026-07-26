@echo off
setlocal EnableExtensions

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass ^
    -File "%~dp0ops\windows\Start-NodeZsb.ps1"

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
    echo [INFO] node-zsb has stopped.
) else (
    echo [ERROR] node-zsb did not start or exited with code %EXIT_CODE%.
)
pause
exit /b %EXIT_CODE%
