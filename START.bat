@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PS Creative Hub V7

echo ============================================
echo       PS Creative Hub V7 - STARTING
echo ============================================

echo Node:
node -v
echo NPM:
call npm.cmd -v
if errorlevel 1 goto npmerror

if not exist ".env" copy /Y ".env.example" ".env" >nul

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto installerror
)

if not exist "data\pshub.db" (
  echo Creating demo database...
  call npm.cmd run seed
  if errorlevel 1 goto seederror
)

if not exist "storage\assets" mkdir "storage\assets"
if not exist "public\uploads\media" mkdir "public\uploads\media"

echo.
echo Starting PS Creative Hub V7...
echo Open: http://localhost:3000
npm.cmd start

echo.
echo Server stopped.
pause
exit /b 0

:npmerror
echo npm is not available. Install Node.js LTS and try again.
pause
exit /b 1
:installerror
echo npm install failed.
pause
exit /b 1
:seederror
echo Database seed failed.
pause
exit /b 1
