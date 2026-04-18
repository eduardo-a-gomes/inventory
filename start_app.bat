@echo off
cd /d C:\AI_code\inventario_novo

REM Matar processos antigos do Node/Vite para libertar portas
taskkill /F /IM node.exe > nul 2>&1

REM Activar venv correto
call backend\.venv\Scripts\activate

REM Arrancar app em background
start /B npm run dev

REM Esperar que o servidor responda
:wait_loop
timeout /t 2 > nul
curl -s http://localhost:5173 > nul 2>&1
if errorlevel 1 goto wait_loop

REM Abrir browser
start http://localhost:5173