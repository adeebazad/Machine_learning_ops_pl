#!/bin/bash

# Start Uvicorn Backend
python3 -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload &

# Start MLflow Server
mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlruns --host 0.0.0.0 --port 5000 &

# Start Frontend
cd frontend
npm run dev
