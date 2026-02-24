@echo off
echo ===================================================
echo   RankingPortal - One-Click Launcher
echo ===================================================
echo.
echo [1/3] Resetting User Password to 'password123'...
node workspace-backend\server\recreate_admin.js

echo.
echo [2/3] Starting Backend Server (Port 3000)...
start "RankingPortal Backend" cmd /k "cd workspace-backend && npm start"

echo.
echo [3/3] Starting Frontend Server (Port 5500)...
start "RankingPortal Frontend" cmd /k "cd workspace-frontend && node serve.js"

echo.
echo ===================================================
echo   ALL SYSTEMS GO! 🚀
echo.
echo   Please navigate to: http://localhost:5500
echo   Login: uzairabbas2025@gmail.com
echo   Pass:  password123
echo ===================================================
pause
