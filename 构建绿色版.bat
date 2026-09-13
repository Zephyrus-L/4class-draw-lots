@echo off
cd /d "%~dp0"
call npm install
call npm run tauri build
echo.
echo 构建完成。可执行文件在 src-tauri\target\release\ 下。
pause
