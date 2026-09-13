@echo off
cd /d "%~dp0"
call npm install
call npm run dev
