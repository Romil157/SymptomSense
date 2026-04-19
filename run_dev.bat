@echo off
setlocal
echo ==========================================
echo SymptomSense - Development Server
echo ==========================================
echo.

:: Check if node_modules exists
if not exist node_modules\ (
    echo [WARNING] node_modules folder not found.
    echo [STATUS] Running npm install first...
    call npm install
)

echo [STATUS] Starting Vite development server...
echo [INFO] Access the app at http://localhost:5173/
echo.

:: --host exposes the server on your network
call npm run dev -- --host

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Development server failed or exited unexpectedly.
    pause
    exit /b 1
)
