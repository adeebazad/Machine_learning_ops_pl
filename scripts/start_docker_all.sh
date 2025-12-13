#!/bin/bash

echo "============================================="
echo "   Automated MLOps Platform Deployment"
echo "============================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    echo "Please install Docker Desktop or Docker Engine first."
    exit 1
fi

echo "[1/3] Stopping any running containers..."
docker compose down

echo "[2/4] Building Services Manually (to avoid network timeouts)..."
# Build API with host network
echo "Building API..."
docker build --network host -t mlops-api:latest .

# Build Frontend with host network
echo "Building Frontend..."
docker build --network host -t mlops-frontend:latest ./frontend

echo "[3/4] Starting Services..."
docker compose up -d
echo "Force restarting Nginx to apply latest config..."
docker compose restart nginx

echo "[4/4] Verifying Deployment..."
sleep 5
docker compose ps

echo ""
echo "============================================="
echo "   Deployment Complete!"
echo "   Dashboard: http://localhost:80"
echo "   API Docs:  http://localhost:8000/docs"
echo "   MLflow:    http://localhost:5000"
echo "============================================="
