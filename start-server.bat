@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting local preview server at http://127.0.0.1:8000/
echo Press Ctrl+C to stop.
start "" "http://127.0.0.1:8000/"
python -m http.server 8000
