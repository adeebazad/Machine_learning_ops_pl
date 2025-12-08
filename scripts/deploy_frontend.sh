#!/bin/bash

echo "============================================="
echo "       Deploying Frontend Services"
echo "============================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    exit 1
fi

echo "[1/2] Building Frontend Image (Host Network)..."
docker build --network host -t mlops-frontend:latest ./frontend

echo "[2/2] Starting Frontend Services (App & Nginx)..."
# Start frontend and the proxy (which depends on both, but mainly exposes frontend/api)
docker compose up --no-build -d frontend nginx

echo "Frontend Deployment Complete!"
docker compose ps
