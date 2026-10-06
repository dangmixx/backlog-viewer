@echo off
rem Tat server Backlog Viewer (port 4321)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":4321 .*LISTENING"') do taskkill /pid %%p /f >nul && echo Da tat server (PID %%p)
