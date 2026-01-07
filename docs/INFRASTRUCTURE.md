# Infrastructure & Deployment

This guide covers the deployment strategies using Docker Compose (for local development/staging) and Kubernetes (for production).

## 🐳 Docker Stack (`docker-compose.yaml`)

The project uses Docker Compose to orchestrate the following services:

| Service | Container Name | Port | Description |
| :--- | :--- | :--- | :--- |
| **api** | `mlops_api` | 8000 | FastAPI Backend |
| **frontend** | `mlops_frontend` | 3000 | React Frontend (Internal) |
| **nginx** | `nginx_proxy` | 80 | Reverse Proxy (Entry point) |
| **mlflow** | `mlflow_server` | 5000 | Experiment Tracking |
| **postgres** | `mlflow_db` | 5432 | DB for MLflow |
| **redis** | `redis_broker` | 6379 | Broker for Celery |
| **celery_worker** | `celery_worker` | N/A | Async Task Worker |

### Running with Docker
```bash
# Start all services
start_docker_all.bat   # Windows
./deploy_unified.sh    # Linux/Mac
```
Or manually:
```bash
docker-compose up -d --build
```

## ☸️ Kubernetes (`k8s/`)

For scalable production deployment, use the manifests located in the `k8s/` directory.

### Manifest Overview
*   **`deployment.yaml`**: Deploys the main backend API.
*   **`frontend.yaml`**: Deploys the frontend UI.
*   **`celery.yaml`**: Deploys the worker nodes.
*   **`redis.yaml` / `mlflow.yaml`**: Infrastructure components.
*   **`ingress.yaml`**: Routing rules for external access.

### Deploying to Minikube
The `deploy.sh` script automates the process:

```bash
./deploy.sh
```
1.  Builds the Docker image inside Minikube's environment.
2.  Applies Secrets and ConfigMaps.
3.  Deploys key services and waits for rollout.

## 🔧 Configuration

### Environment Variables
Key configuration is managed via `config/config.yaml` or environment variables passed to containers:
*   `MLFLOW_TRACKING_URI`: URL for the MLflow server.
*   `CELERY_BROKER_URL`: Redis connection string.
*   `POSTGRES_USER` / `POSTGRES_PASSWORD`: Database credentials.

### Nginx Proxy
The **Nginx** container acts as the main gateway, routing traffic to:
*   `/api` -> Backend API
*   `/` -> Frontend
*   `/mlflow` -> MLflow UI
