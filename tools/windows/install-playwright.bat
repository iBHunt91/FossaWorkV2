@echo off
echo 🎯 Installing Playwright for Real Browser Automation
echo ================================================
echo.

cd backend
echo 📦 Installing Python packages...
python -m pip install playwright websockets aiofiles
if errorlevel 1 (
    echo ❌ Failed to install with python -m pip, trying pip directly...
    pip install playwright websockets aiofiles
)

echo.
echo 🌐 Installing browser drivers...
python -m playwright install
if errorlevel 1 (
    echo ❌ Failed to install browsers with python -m playwright, trying direct command...
    playwright install
)

echo.
echo ✅ Playwright installation complete!
echo.
echo 🔄 Next steps:
echo 1. Test with: python -c "import playwright; print('✅ Playwright imported successfully')"
echo 2. Start the full automation system
echo.
pause