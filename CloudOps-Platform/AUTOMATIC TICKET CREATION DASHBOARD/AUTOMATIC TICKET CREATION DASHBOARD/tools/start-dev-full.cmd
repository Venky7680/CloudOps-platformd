@echo off
setlocal

cd /d "%~dp0\.."

set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not exist "%NODE_EXE%" goto :node_missing

if not exist "node_modules\vite\bin\vite.js" goto :deps_missing

echo Starting Mock API on http://localhost:5000/api ...
start "Mock API" "%NODE_EXE%" "mock-api\server.js"

echo Starting Frontend on http://localhost:5173/ ...
start "Frontend" "%NODE_EXE%" "node_modules\vite\bin\vite.js"

echo.
echo OPEN THIS URL:
echo   http://localhost:5173/
echo.
echo API URL:
echo   http://localhost:5000/api
echo.
pause
exit /b 0

:node_missing
echo ERROR: Node not found at "%NODE_EXE%".
echo Please install Node.js for Windows (LTS) and try again.
pause
exit /b 1

:deps_missing
echo ERROR: node_modules not found.
echo Run tools\install.cmd first.
pause
exit /b 1

