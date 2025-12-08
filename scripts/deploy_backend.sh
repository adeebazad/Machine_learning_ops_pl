#!/bin/bash

echo "============================================="
echo "       Deploying Backend Services"
echo "============================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    exit 1
fi

echo "[1/2] Building API Image (Host Network)..."
docker build --network host -t mlops-api:latest .

echo "[2/2] Starting Backend Services (API, Celery, MLflow, Redis)..."
# We start explicit dependencies plus the API and Worker
docker compose up -d api celery_worker mlflow redis

echo "Backend Deployment Complete!"
docker compose ps
