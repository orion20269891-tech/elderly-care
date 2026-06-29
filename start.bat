@echo off
chcp 65001 >nul
echo 正在启动颐馨园养老管理系统...
start http://localhost:3000
node server.js
pause
