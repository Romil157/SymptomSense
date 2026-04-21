@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo SymptomSense - One Click Launcher
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not available on PATH. Please reinstall Node.js.
    pause
    exit /b 1
)

if not exist node_modules\ (
    echo [STATUS] node_modules not found. Installing dependencies...
    call npm install
    if errorlevel 1 goto :install_fail
) else (
    echo [STATUS] Dependencies already installed.
)

if not exist .env (
    if exist .env.example (
        echo [STATUS] Creating .env from .env.example...
        copy /Y .env.example .env >nul
    ) else (
        echo [WARNING] .env.example not found. Please create .env manually.
    )
)

echo [STATUS] Processing dataset...
node clean_dataset.cjs
if errorlevel 1 goto :clean_fail

echo.
echo [STATUS] Starting frontend and backend together...
echo [INFO] Frontend: http://localhost:5173/
echo [INFO] Backend:  http://localhost:4000/
echo [INFO] Default local login:
echo        Email:    clinician@symptomsense.local
echo        Password: StrongPassword123!
echo.

call npm run dev
if errorlevel 1 goto :dev_fail

exit /b 0

:install_fail
echo.
echo [ERROR] Installation failed.
pause
exit /b 1

:clean_fail
echo.
echo [ERROR] Dataset processing failed. Please check the logs above.
pause
exit /b 1

:dev_fail
echo.
echo [ERROR] Development server failed or exited unexpectedly.
pause
exit /b 1
