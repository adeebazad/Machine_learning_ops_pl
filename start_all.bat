@echo off
echo Starting MLOps Platform...

:: Start MLflow (in background)
start "MLflow" cmd /c "mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlruns --host 0.0.0.0 --port 5000"

:: Start Backend API (in background)
start "Backend API" cmd /c "python src/api.py"

:: Start Frontend (in background)
cd frontend
start "Frontend" cmd /c "npm run dev"
cd ..

echo All services started!
echo MLflow: http://localhost:5000
echo API: http://localhost:8001
echo Frontend: http://localhost:3000
