#!/bin/bash

echo "============================================="
echo "       Deploying Backend Services"
echo "============================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    exit 1
fi

echo "[0/2] Cleaning up old Backend Services..."
# Force remove containers by name to ensure ports are release
docker rm -f mlops_api celery_worker mlflow_server redis_broker || true

echo "[1/2] Building API Image (Host Network)..."
docker build --network host -t mlops-api:latest .
# Tag specifically for celery worker if compose defaults to project-service naming
docker tag mlops-api:latest machine_learning_ops_pl-celery_worker:latest

echo "[2/2] Starting Backend Services (API, Celery, MLflow, Redis)..."
# We start explicit dependencies plus the API and Worker
docker compose up --no-build -d api celery_worker mlflow redis

echo "Backend Deployment Complete!"
docker compose ps
