#!/bin/bash

# Exit on error
set -e

echo "Starting deployment on Ubuntu..."

# 1. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed. Please log out and back in for group changes to take effect, or run 'newgrp docker'."
else
    echo "Docker is already installed."
fi

# 2. Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Checking for docker compose plugin..."
    if docker compose version &> /dev/null; then
        echo "Docker Compose plugin found."
    else
        echo "Installing Docker Compose..."
        sudo apt-get install -y docker-compose-plugin
    fi
fi

# 3. Deploy
echo "Building and starting containers..."
# Use 'docker compose' (v2) instead of 'docker-compose' (v1) if available
if docker compose version &> /dev/null; then
    docker compose up -d --build
else
    docker-compose up -d --build
fi

echo "Deployment complete! Access the application at http://localhost (or your server IP)."
