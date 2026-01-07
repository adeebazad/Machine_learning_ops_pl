# MLOps Platform Backend

The backend is built with Python 3.9+ using **FastAPI** for the REST API and a custom **Pipeline Engine** for orchestrating ML workflows. It leverages **SQLAlchemy** for database interactions and **MLflow** for experiment tracking.

## 🏗️ Architecture

The backend follows a modular layered architecture:

*   **API Layer (`src/routers`)**: Exposes REST endpoints.
*   **Service Layer (`src/pipeline`)**: Contains business logic for extraction, preprocessing, training, and prediction.
*   **Data Layer (`src/data`)**: Handles connections to diverse data sources (MySQL, Mongo, CrateDB).
*   **Infrastructure (`src/infrastructure`)**: Database models and shared utilities.

## 🔌 API Modules

The API is organized into several routers, located in `src/routers/`:

*   `pipelines.py`: Database CRUD operations for Pipeline definitions.
*   `experiments.py`: Interface with MLflow to track runs and metrics.
*   `files.py`: File upload and management (for CSVs/Datasets).
*   `dashboards.py`: Aggregated metrics for the frontend dashboard.
*   `scheduler.py`: Management of scheduled training jobs.
*   `mlflow_router.py`: Proxy for specific MLflow artifacts.

## ⚙️ Pipeline Engine (`src/pipeline_engine.py`)

The heart of the platform is the **PipelineEngine** class. It executes a sequence of `PipelineStep` objects.

### Execution Flow
1.  **Context Initialization**: Creates a shared `context` dictionary.
2.  **Step Execution**: Iterates through steps sorted by `order`.
    *   **Extraction**: Loads data from source. Updates `context["data"]`.
    *   **Preprocessing**: Cleans/Transforms data. Updates `context["data"]`.
    *   **Training**: Trains a model. Updates `context["model"]`.
    *   **Prediction**: Generates inference. Updates `context["predictions"]`.
3.  **Caching**: Intermediate results are cached in `cache/pipeline_{id}_step_{order}.joblib` to allow for interactive debugging in the UI.
4.  **Logging**: Execution logs and status are persisted to the `PipelineRun` database record.

## 🧬 Key Modules

### Features (`src/features`)
Contains logic for specific ML capabilities.
*   `preprocess.py`: Pandas-based data cleaning and transformation.
*   `features/`: Feature engineering logic.

### Infrastructure (`src/infrastructure`)
*   `database.py`: SQLAlchemy `get_db` dependency.
*   `models.py`: ORM definitions for `Pipeline`, `PipelineStep`, `PipelineRun`.

## 🧪 Testing
Unit tests are located in `tests/`. The system supports valid/invalid pipeline configuration testing.

```bash
# Run tests
pytest tests/
```
