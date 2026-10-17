@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 維多利亞港 · VOXEL VICTORIA HARBOUR
if exist "dist\VictoriaHarbour.html" (
  echo Opening Victoria Harbour — voxel digital twin...
  start "" "dist\VictoriaHarbour.html"
) else (
  echo Building single-file sandbox...
  node tools\build.mjs
  if errorlevel 1 (
    echo Build failed. Make sure Node.js is installed.
    pause
    exit /b 1
  )
  start "" "dist\VictoriaHarbour.html"
)
