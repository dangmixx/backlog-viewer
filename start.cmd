@echo off
rem Backlog Viewer - mo nhanh. Neu server dang chay thi chi mo trinh duyet.
rem Server chay an, tu tat khi dong het tab (--auto-exit).
cd /d "%~dp0"
set URL=http://localhost:4321
curl -s -o nul %URL%/api/projects
if %errorlevel%==0 goto open
powershell -NoProfile -Command "Start-Process node -ArgumentList 'server.js','--auto-exit' -WorkingDirectory '%~dp0.' -WindowStyle Hidden"
rem cho server san sang (toi da ~5s)
for /l %%i in (1,1,10) do (
  curl -s -o nul %URL%/api/projects && goto open
  ping -n 1 -w 500 127.0.0.1 >nul
)
:open
start "" %URL%
