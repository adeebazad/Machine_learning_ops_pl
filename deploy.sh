#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Deployment..."

# 1. Build Docker Image
echo "📦 Building Docker image..."
# Use minikube docker env if available, otherwise standard build
if command -v minikube &> /dev/null; then
    echo "   Using Minikube Docker environment..."
    eval $(minikube -p minikube docker-env)
fi

docker build -t my-mlops-app:latest .

# 2. Apply Kubernetes Manifests
echo "☸️  Applying Kubernetes manifests..."

# Apply Secrets and ConfigMaps first
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# Apply Deployment and Service
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Apply Ingress (if applicable)
if [ -f k8s/ingress.yaml ]; then
    kubectl apply -f k8s/ingress.yaml
fi

# 3. Status Check
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/mlops-backend

echo "✅ Deployment completed successfully!"
echo "   Service URL (Minikube): $(minikube service mlops-backend --url 2>/dev/null || echo 'Check kubectl get svc')"
