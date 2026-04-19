@echo off
setlocal
echo ==========================================
echo SymptomSense - Project Installation
echo ==========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

echo [STATUS] Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Installation failed.
    pause
    exit /b 1
) else (
    echo.
    echo [SUCCESS] Dependencies installed successfully.
)
