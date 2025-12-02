@echo off
echo ==========================================
echo Starting MLOps Platform
echo ==========================================

echo 1. Starting MLflow Server...
start "MLflow Server" cmd /k "scripts\start_mlflow.bat"

echo 2. Starting Backend API...
start "MLOps Backend" cmd /k "scripts\start_api.bat"

echo 3. Starting Frontend...
start "MLOps Frontend" cmd /k "scripts\start_frontend.bat"

echo ==========================================
echo All services launched in separate windows.
echo Access the UI at: http://localhost:5173 (Backend: http://localhost:8001)
echo ==========================================
pause
