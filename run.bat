@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
python -m pip install -q -r requirements.txt
start "" http://127.0.0.1:8050
python app.py
