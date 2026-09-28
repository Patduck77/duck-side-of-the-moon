@echo off
title Construction ESTELLE 0.7.1
chcp 65001 >nul

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo ==========================================
echo   ESTELLE - CONSTRUCTION VERSION PUBLIQUE
echo ==========================================
echo.

if not exist "C:\ESTELLE" (
  echo ERREUR : le dossier C:\ESTELLE est introuvable.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='https://raw.githubusercontent.com/Patduck77/duck-side-of-the-moon/main/estelle-build/Build-ESTELLE-HarpaGO.ps1';" ^
  "$p='C:\ESTELLE\Build-ESTELLE-HarpaGO.ps1';" ^
  "Write-Host 'Téléchargement du script de construction...' -ForegroundColor Cyan;" ^
  "Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $p;" ^
  "Write-Host 'Lancement...' -ForegroundColor Cyan;" ^
  "& $p"

echo.
echo ==========================================
echo   FIN DU TRAITEMENT
echo ==========================================
echo.
echo Vérifie le dossier :
echo C:\ESTELLE\Release\Installer
echo.
pause
