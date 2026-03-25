Write-Host "Iniciando Nova Assistant (Cara, Cerebro y Oídos)..." -ForegroundColor Cyan

# 1. El Cerebro (Backend)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- EL CEREBRO (Node.js) ---' -ForegroundColor Yellow; cd backend; node server.js"

# 2. Los Oídos (Voz / Python)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- LOS OÍDOS (Python) ---' -ForegroundColor Green; cd voice; .\venv\Scripts\activate; python main.py"

# 3. La Cara (Frontend / Vite)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- LA CARA (Vite) ---' -ForegroundColor Magenta; cd frontend; npm run dev"

Write-Host "¡Las 3 terminales se han abierto automáticamente en ventanas separadas!" -ForegroundColor Green
Write-Host "Si la ventana del 'Cerebro' (Node.js) marca error de 'Puerto en uso', asegúrate de cerrar otras terminales Node que ya tengas abiertas." -ForegroundColor Yellow
