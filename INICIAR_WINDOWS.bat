@echo off
setlocal
cd /d "%~dp0"
title ReqCode AI

if not exist .env (
  echo.
  echo [ERROR] No existe el archivo .env
  echo Copia .env.example como .env y coloca tu GEMINI_API_KEY.
  echo Puedes obtener una clave gratuita en https://aistudio.google.com/apikey
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

start "" http://localhost:3000
npm start
pause
