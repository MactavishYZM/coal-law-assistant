@echo off
chcp 65001 > nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0部署到GitHub.ps1"
echo.
if errorlevel 1 echo 部署失败，请检查上面的错误和GitHub登录状态。
pause
