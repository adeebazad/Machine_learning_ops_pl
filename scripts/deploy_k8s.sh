#!/bin/bash

echo "============================================="
echo "   MLOps Platform Kubernetes Deployment"
echo "============================================="

echo "[1/3] Building Docker Images..."
# Build images locally so they are available to K8s (assuming Docker Desktop/Minikube with Docker driver)
docker build -t mlops-api:latest .
docker build -t mlops-frontend:latest ./frontend

echo "[2/3] Applying Kubernetes Manifests..."
# Apply all manifests in the k8s directory
kubectl apply -f k8s/

echo "[3/3] Deployment Applied!"
echo "Waiting for pods to be ready..."
kubectl get pods

echo ""
echo "============================================="
echo "   Deployment Steps Complete!"
echo "   Please check pod status with: kubectl get pods"
echo "   Once running, access via: http://localhost"
echo "============================================="
