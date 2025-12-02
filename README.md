# End-to-End MLOps Pipeline

This project implements a complete MLOps pipeline using open-source tools.

## Features
- **Data Layer**: Connectors for MySQL, PostgreSQL, CrateDB, and MongoDB.
- **ML Pipeline**: Scikit-learn training, preprocessing, and inference.
- **Tracking**: MLflow for experiment tracking.
- **Versioning**: DVC for data versioning.
- **Deployment**: Docker and Kubernetes ready.

## Project Structure
```
mlops-pipeline/
├── config/                 # Configuration files
├── data/                   # Data storage (DVC tracked)
├── docker/                 # Docker related files
├── k8s/                    # Kubernetes manifests
├── scripts/                # Utility scripts
├── src/                    # Source code
│   ├── data/               # Database connectors
│   ├── features/           # Feature engineering
│   ├── models/             # Training and inference
│   ├── monitoring/         # Drift detection
│   └── utils/              # Utilities
├── tests/                  # Unit tests
├── requirements.txt
├── Dockerfile
└── README.md
```

## Setup Instructions

### 1. Prerequisites
- Python 3.9+
- Docker
- Kubernetes (Minikube or similar)
- Database (MySQL/Postgres/etc.) running locally or accessible.

### 2. Installation
```bash
pip install -r requirements.txt
```

### 3. Data Versioning (DVC)
Initialize DVC and setup remote (local for demo):
```bash
./scripts/init_dvc.bat
```

### 4. Configuration
Edit `config/config.yaml` to match your database credentials and MLflow URI.

### 5. Running Locally
**Train:**
```bash
python src/main.py --config config/config.yaml
```

**Inference:**
```bash
python src/models/predict.py --config config/config.yaml --model-uri runs:/<run_id>/model
```

### 6. Docker
Build the image:
```bash
docker build -t mlops-pipeline:latest .
```

Run container:
```bash
docker run -v $(pwd)/config:/app/config mlops-pipeline:latest
```

### 7. Kubernetes Deployment
Apply manifests:
```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 8. Scheduled Training
Run the scheduler to execute training daily at a specific time:
```bash
python src/scheduler.py --config config/config.yaml --time 14:30
```

### 9. Docker Compose & Reverse Proxy
Run the full stack with Nginx:
```bash
docker-compose up -d
```
Access MLflow at `http://localhost`.

### 10. CI/CD
The project includes a GitHub Actions workflow in `.github/workflows/ci_cd.yaml` that runs tests and builds the Docker image on push to `main`.
