@echo off
chcp 65001 >nul
where python >nul 2>nul && (start http://localhost:8080 & python -m http.server 8080) || (where node >nul 2>nul && (start http://localhost:8080 & node tools\serve.js) || echo Нужен Python или Node.js)
