@echo off
echo ===============================
echo   FOSSA MONITOR - APP STARTER
echo ===============================
echo.
echo Choose startup method:
echo.
echo 1) Standard Start (recommended)
echo 2) Fast Start (if already running once today)
echo 3) Safe Start (if having issues)
echo 4) Force Shutdown App
echo 5) Show Help
echo.
set /p choice=Enter option (1-5): 

if "%choice%"=="1" (
  echo.
  echo Starting app (standard mode)...
  call npm run electron:dev:start
) else if "%choice%"=="2" (
  echo.
  echo Starting app (fast mode)...
  call npm run electron:dev:fast
) else if "%choice%"=="3" (
  echo.
  echo Starting app (safe mode with full cleanup)...
  call npm run electron:dev:safe
) else if "%choice%"=="4" (
  echo.
  echo Shutting down all app processes...
  call npm run electron:shutdown
  echo.
  echo App shutdown complete. Press any key to exit.
  pause > nul
) else if "%choice%"=="5" (
  echo.
  call npm run electron:help
  echo.
  echo Press any key to exit.
  pause > nul
) else (
  echo.
  echo Invalid option. Please run again and select 1-5.
  echo.
  pause
) 