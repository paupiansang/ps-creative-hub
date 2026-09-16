@echo off
setlocal
cd /d "%~dp0"
set "SOURCE="
if exist "..\PS-Creative-Hub-V5\data\pshub.db" set "SOURCE=..\PS-Creative-Hub-V5\data\pshub.db"
if not defined SOURCE if exist "..\PS-Creative-Hub-V4\data\pshub.db" set "SOURCE=..\PS-Creative-Hub-V4\data\pshub.db"

if not defined SOURCE (
  echo No V4/V5 database found next to V6.
  echo Nothing was copied.
  pause
  exit /b 0
)

if exist "data\pshub.db" (
  echo V6 already has a database. No changes made.
  pause
  exit /b 0
)

mkdir data 2>nul
copy /Y "%SOURCE%" "data\pshub.db" >nul
echo Existing database copied into V6.
echo Your products, users and purchases can now be used by V6.
pause
endlocal
