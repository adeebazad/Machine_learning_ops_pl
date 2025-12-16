#!/bin/bash

echo "============================================="
echo "   Automated MLOps Platform Deployment"
echo "============================================="

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    if netstat -an | grep -q ":$port .*LISTEN"; then
        return 0 # True, it is in use
    else
        return 1 # False, it is free
    fi
}

# 1. Detect Server IP
echo "Detecting Server IP..."
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    # Fallback to ipconfig for Windows
    SERVER_IP=$(ipconfig 2>/dev/null | grep "IPv4" | grep -v "127.0.0.1" | head -n 1 | awk -F: '{print $2}' | tr -d ' \r')
fi
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="localhost"
fi
echo "Detected IP: $SERVER_IP"

# 2. Find a Free Port
APP_PORT=80
echo "Finding a free port starting from $APP_PORT..."
while is_port_in_use $APP_PORT; do
    echo "Port $APP_PORT is in use. Checking next..."
    ((APP_PORT++))
    if [ $APP_PORT -gt 65535 ]; then
        echo "Error: No free ports found."
        exit 1
    fi
done
echo "Selected Port: $APP_PORT"
export APP_PORT

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
echo "Starting application on port $APP_PORT..."
docker compose up -d
echo "Force restarting Nginx to apply latest config..."
docker compose restart nginx

echo "[4/4] Verifying Deployment..."
sleep 5
docker compose ps

echo ""
echo "============================================="
echo "   Deployment Complete!"
echo "   Dashboard: http://$SERVER_IP:$APP_PORT"
echo "   API Docs:  http://$SERVER_IP:8000/docs"
echo "   MLflow:    http://$SERVER_IP:5000"
echo "============================================="
