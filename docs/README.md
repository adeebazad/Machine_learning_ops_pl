# AI_ML_Platform

**A comprehensive, production-ready MLOps and Multi-Modal AI Platform.**

This repository hosts a complete end-to-end MLOps ecosystem alongside `Pearl`, a multi-modal AI agent service. It is designed for scalability, modularity, and ease of deployment using Docker and Kubernetes.

## 📂 Project Structure

The project is divided into two primary sub-systems:

### 1. [Machine_learning_ops_pl](./MLOPS_BACKEND.md)
The core MLOps engine handling the complete machine learning lifecycle.
*   **Backend**: Python-based API (FastAPI) for pipeline orchestration, training, and inference.
*   **Frontend**: React + Vite dashboard for analytics, pipeline management, and visualization.
*   **Capabilities**:
    *   **Data Ingestion**: Connectors for SQL (MySQL/Postgres) and NoSQL (MongoDB/CrateDB).
    *   **Pipeline Engine**: Custom DAG-based execution engine for ML workflows.
    *   **MLflow Integration**: Full experiment tracking and model registry.
    *   **DVC**: Data version control and storage management.

### 2. [Pearl](./PEARL_SERVICE.md)
**P**latform for **E**lastic **A**gents with contextual **R**easoning over **L**ayered modalities.
*   A specialized service for building and deploying AI agents.
*   Features contextual reasoning and multi-modal capabilities.
*   Integrated with the main platform for data and model usage.

## 🚀 Quick Start

### Prerequisites
*   **Docker Desktop** (running)
*   **Python 3.9+**
*   **Node.js 18+** (for local frontend dev)

### One-Click Deployment (Docker)
To start the entire stack including MLOps backend, frontend, database, and MLflow:

```bash
# Windows
start_docker_all.bat

# Linux/Mac
./deploy_unified.sh
```

Access the services:
*   **Dashboard**: `http://localhost:5173` (or configured port)
*   **MLflow**: `http://localhost:5000`
*   **API Docs**: `http://localhost:8000/docs`

## 📚 Documentation Index

*   **[Backend Architecture](./MLOPS_BACKEND.md)**: Detailed guide to the Python APIs, Pipeline Engine, and Modules.
*   **[Frontend Guide](./MLOPS_FRONTEND.md)**: React components, analytics engine, and UI architecture.
*   **[Pearl Service](./PEARL_SERVICE.md)**: Architecture and usage of the Pearl agent platform.
*   **[Infrastructure & Ops](./INFRASTRUCTURE.md)**: Docker compose setups, Kubernetes manifests, and deployment scripts.

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend** | Python, FastAPI, Celery, Pandas, Scikit-learn, PyTorch |
| **Frontend** | React, TypeScript, Vite, TailwindCSS, Recharts |
| **Data & Ops** | MLflow, DVC, PostgreSQL, MongoDB, CrateDB |
| **Infrastructure** | Docker, Kubernetes, Nginx |

## 📜 License
[MIT License](LICENSE)
