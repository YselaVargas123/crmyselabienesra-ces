@echo off
setlocal
cd /d "%~dp0"
title CRM Ysela - Conector WhatsApp
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o posterior desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist "whatsapp-local\node_modules\@whiskeysockets\baileys\package.json" (
  echo Preparando el conector por primera vez...
  call npm --prefix whatsapp-local ci
  if errorlevel 1 (
    echo No se pudo preparar. Comprueba tu conexion a internet y vuelve a intentarlo.
    pause
    exit /b 1
  )
)
call npm run whatsapp
pause
