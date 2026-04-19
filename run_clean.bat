@echo off
setlocal
echo ==========================================
echo SymptomSense - Dataset Processing
echo ==========================================
echo.

echo [STATUS] Running dataset cleaning and condensation script...
echo.

:: Use the .cjs file specifically since it contains CommonJS (require)
:: logic while package.json is set to "type": "module".
node clean_dataset.cjs

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Dataset processing failed. Please check the logs above.
    pause
    exit /b 1
) else (
    echo.
    echo [SUCCESS] Dataset processed and saved to /public/cleaned_dataset.csv
)
