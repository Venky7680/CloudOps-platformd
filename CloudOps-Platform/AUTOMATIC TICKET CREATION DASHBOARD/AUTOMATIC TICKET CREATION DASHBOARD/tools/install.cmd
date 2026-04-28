@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "NPM_CLI=C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"

if not exist "%NODE_EXE%" goto :node_missing
if not exist "%NPM_CLI%" goto :npm_missing

echo Installing dependencies using "%NODE_EXE%"...
"%NODE_EXE%" "%NPM_CLI%" install
if errorlevel 1 exit /b 1

echo.
echo Done.
echo Next: run tools\start-dev-full.cmd
echo.
pause
exit /b 0

:node_missing
echo ERROR: Node not found at "%NODE_EXE%".
echo Please install Node.js for Windows (LTS) and try again.
pause
exit /b 1

:npm_missing
echo ERROR: npm-cli.js not found at "%NPM_CLI%".
echo Please reinstall Node.js (LTS) and try again.
pause
exit /b 1

