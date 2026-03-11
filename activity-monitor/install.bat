@echo off
echo ==================================
echo   Activity Intensity Monitor Setup
echo ==================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is required. Install from https://python.org
    pause
    exit /b 1
)

echo Python found.
echo Installing dependencies...
python -m pip install --user -r requirements.txt

echo.
echo Setup complete!
echo.
echo To run the monitor:
echo   set SUPABASE_KEY=your-supabase-anon-key
echo   python monitor.py
echo.
pause
