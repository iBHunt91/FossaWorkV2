@echo off
color 0A
echo ============================================
echo   FOSSA MONITOR - TROUBLESHOOTING UTILITY
echo ============================================
echo.
echo This utility will help fix app startup issues
echo.

:menu
echo Choose an option:
echo.
echo 1) Full App Reset (Recommended Fix)
echo 2) Kill All App Processes
echo 3) Clean Vite Cache Only
echo 4) Try Safe Startup
echo 5) Port Scanner - Check Process Conflicts
echo 6) Show App Help
echo 7) Exit
echo.
set /p choice=Enter option (1-7): 

if "%choice%"=="1" (
  call :full_reset
) else if "%choice%"=="2" (
  call :kill_processes
) else if "%choice%"=="3" (
  call :clean_cache
) else if "%choice%"=="4" (
  call :safe_start
) else if "%choice%"=="5" (
  call :scan_ports
) else if "%choice%"=="6" (
  call :show_help
) else if "%choice%"=="7" (
  exit
) else (
  echo.
  echo Invalid option. Please select 1-7.
  echo.
  pause
  cls
  goto menu
)

goto menu

:full_reset
echo.
echo ========= PERFORMING FULL APP RESET =========
echo.
echo 1. Killing all app processes...
call npm run electron:shutdown
echo.
echo 2. Cleaning Vite cache...
call npm run fix-vite-cache
echo.
echo 3. Clearing temporary files...
if exist ".vite" rmdir /S /Q ".vite"
if exist "node_modules\.vite" rmdir /S /Q "node_modules\.vite"
if exist ".postcss-cache" rmdir /S /Q ".postcss-cache"
echo.
echo 4. Cleaning up port conflicts...
call npm run free-port
echo.
echo 5. Waiting 5 seconds for processes to fully terminate...
timeout /t 5 /nobreak > nul
echo.
echo 6. Starting app in safe mode...
call npm run electron:dev:safe
echo.
pause
cls
goto menu

:kill_processes
echo.
echo ========= KILLING ALL APP PROCESSES =========
echo.
call npm run electron:shutdown
echo.
echo ✅ All app processes have been terminated.
echo.
pause
cls
goto menu

:clean_cache
echo.
echo ========= CLEANING VITE CACHE =========
echo.
call npm run fix-vite-cache
echo.
echo ✅ Vite cache has been cleaned.
echo.
pause
cls
goto menu

:safe_start
echo.
echo ========= STARTING APP IN SAFE MODE =========
echo.
call npm run electron:dev:safe
echo.
pause
cls
goto menu

:scan_ports
echo.
echo ========= SCANNING FOR PORT CONFLICTS =========
echo.
echo Checking common ports used by the app...
echo.
echo Checking port 3001 (Server):
netstat -ano | findstr :3001
echo.
echo Checking Vite ports (5173-5180):
netstat -ano | findstr :5173
netstat -ano | findstr :5174
netstat -ano | findstr :5175
netstat -ano | findstr :5176
netstat -ano | findstr :5177
netstat -ano | findstr :5178
echo.
echo If you see any processes using these ports, you can kill them with:
echo taskkill /PID [PID] /F
echo.
echo Or use option 2 from the main menu to kill all app processes.
echo.
pause
cls
goto menu

:show_help
echo.
echo ========= APP STARTUP HELP =========
echo.
call npm run electron:help
echo.
pause
cls
goto menu 