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

echo "[2/3] Building and Starting Services..."
# --build: Force rebuild of images to pick up code changes
# -d: Detached mode (background)
docker compose up --build -d

echo "[3/3] Verifying Deployment..."
sleep 5
docker compose ps

echo ""
echo "============================================="
echo "   Deployment Complete!"
echo "   Dashboard: http://localhost:80"
echo "   API Docs:  http://localhost:8000/docs"
echo "   MLflow:    http://localhost:5000"
echo "============================================="
