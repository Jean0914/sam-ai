@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
title Lanzador de Sam
color 0b
echo ==========================================
echo    INICIANDO NOVA ASSISTANT (SAM)
echo ==========================================

:: 1. Limpiar puertos para evitar errores de "EADDRINUSE"
echo [+] Liberando puerto 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /f /pid %%a >nul 2>&1

:: 2. Iniciar el Backend (Cerebro)
echo [+] Iniciando Cerebro (Node.js)...
start /min "Sam Backend" cmd /c "cd /d "%SCRIPT_DIR%backend" && node server.js"

:: 3. Iniciar los Oidos (Voz)
echo [+] Iniciando Oidos (Python)...
start /min "Sam Voice" cmd /c "cd /d "%SCRIPT_DIR%voice" && .\venv\Scripts\activate && python main.py"

:: 4. Iniciar la Cara (Frontend) y abrir navegador
echo [+] Iniciando Interfaz (Vite)...
start /min "Sam Frontend" cmd /c "cd /d "%SCRIPT_DIR%frontend" && npm run dev"

echo ==========================================
echo    SAM YA ESTA ESCUCHANDO EN SEGUNDO PLANO
echo ==========================================
echo Espera 5 segundos a que cargue la interfaz...
timeout /t 5 >nul
start msedge http://localhost:5173
exit
