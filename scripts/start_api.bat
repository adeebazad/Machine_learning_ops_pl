@echo off
set PYTHONIOENCODING=utf-8
echo Starting FastAPI Service...
python -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload
pause
