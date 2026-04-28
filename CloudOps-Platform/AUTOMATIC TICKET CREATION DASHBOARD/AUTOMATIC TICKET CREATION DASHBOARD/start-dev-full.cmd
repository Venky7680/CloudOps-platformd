@echo off
setlocal

set NODE_EXE=C:\Program Files\nodejs\node.exe

if not exist "%NODE_EXE%" (
  echo ERROR: Could not find "%NODE_EXE%".
  echo Please install Node.js (Windows) or update start-dev-full.cmd with your node path.
  exit /b 1
)

echo Starting Incident Dashboard (mock API + frontend)...
echo - API:  http://localhost:5000/api
echo - Web:  http://localhost:5173/
echo.

"%NODE_EXE%" tools\run-dev-full.js

