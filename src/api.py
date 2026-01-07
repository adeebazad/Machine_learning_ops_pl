import sys
import os
import yaml
import mlflow.sklearn
import pandas as pd
import io
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from src.models.train import train
from src.features.preprocess import DataPreprocessor
from src.utils.dynamic_loader import load_class_from_file
from src.routers import config, database, system, files, scheduler, mlflow_router, experiments, dashboards
from src.infrastructure.database import get_db, engine
from src.infrastructure.models import TrainingConfig, TrainingJob, Experiment
from sqlalchemy.orm import Session
from fastapi import Depends

# ... (logger setup) ...

# Remove Celery import
# from src.tasks import train_model_task

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

app = FastAPI(title="MLOps Pipeline API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(config.router)
app.include_router(database.router)
app.include_router(system.router)

print("DEBUG: Registering files router...")
for route in files.router.routes:
    print(f"DEBUG: Found route: {route.path}")

app.include_router(files.router)
app.include_router(scheduler.router)
app.include_router(mlflow_router.router)
app.include_router(experiments.router)

from src.routers import pipelines
app.include_router(pipelines.router)
app.include_router(dashboards.router)

# Start Scheduler
from src.scheduler import scheduler as pipeline_scheduler
@app.on_event("startup")
def start_scheduler():
    pipeline_scheduler.start()

@app.on_event("shutdown")
def stop_scheduler():
    pipeline_scheduler.stop()

# Load Config
CONFIG_PATH = "config/config.yaml"

def load_config(path):
    with open(path, 'r') as file:
        return yaml.safe_load(file)

# Global model cache
model_cache = {}

class PredictionRequest(BaseModel):
    data: List[Dict[str, Any]]
    model_uri: Optional[str] = None
    config_id: Optional[int] = None
    days_to_predict: Optional[int] = 0

class TrainingRequest(BaseModel):
    config_id: int

def run_training_task(job_id: int):
    db = next(get_db())
    try:
        # Fetch job
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            logger.error(f"Job ID {job_id} not found during background task execution")
            return
            
        # Fetch config
        config_record = db.query(TrainingConfig).filter(TrainingConfig.id == job.config_id).first()
        if not config_record:
            logger.error(f"Config ID {job.config_id} not found for Job {job_id}")
            job.status = "failed"
            db.commit()
            return

        job.status = "running"
        db.commit()

        logger.info(f"Starting background training for Job {job.id} (Config: {config_record.name})")
        
        # Run Training (Pass config dictionary directly if supported, or save to temp file)
        # For now, we'll save to a temp file to maintain compatibility with train.py
        import json
        import tempfile
        
        # Create temp config file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as tmp:
            yaml.dump(config_record.config_json, tmp)
            tmp_config_path = tmp.name
            
        try:
            run_id = train(tmp_config_path)
            
            # Update Job Status
            job.status = "completed"
            job.mlflow_run_id = run_id
            db.commit()
            
            logger.info(f"Background training completed. Run ID: {run_id}")
            
        except Exception as e:
            job.status = "failed"
            db.commit()
            raise e
        finally:
            # Cleanup temp file
            if os.path.exists(tmp_config_path):
                os.remove(tmp_config_path)
                
    except Exception as e:
        logger.error(f"Background training failed: {e}")
    finally:
        db.close()

@app.post("/train")
def trigger_training(request: TrainingRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Verify config exists
    config_record = db.query(TrainingConfig).filter(TrainingConfig.id == request.config_id).first()
    if not config_record:
        raise HTTPException(status_code=404, detail="Config not found")
    
    # Create Job Record Synchronously
    job = TrainingJob(experiment_id=config_record.experiment_id, config_id=request.config_id, status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Use Native BackgroundTasks
    background_tasks.add_task(run_training_task, job.id)
    return {"message": "Training triggered in background", "config_id": request.config_id, "job_id": job.id}

from fastapi.responses import StreamingResponse
from src.reports.generator import generate_report_bytes

class ReportChart(BaseModel):
    title: str = "Untitled Chart"
    type: str = "custom"
    observations: str = ""
    image: Optional[str] = None
    data_snapshot: Optional[List[Dict[str, Any]]] = None

class ReportRequest(BaseModel):
    title: str = "Dashboard Analysis Report"
    description: str = ""
    metrics: List[Dict[str, Any]] = [] # [{"label": "Accuracy", "value": "0.95"}]
    charts: List[ReportChart] = []
    observations: str = ""

@app.post("/report/generate")
def generate_report(request: ReportRequest):
    try:
        pdf_bytes = generate_report_bytes(request.dict())
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
        )
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from src.features.preprocess import DataPreprocessor

@app.post("/predict")
def predict(request: PredictionRequest, db: Session = Depends(get_db)):
    try:
        config = {}
        if request.config_id:
             config_record = db.query(TrainingConfig).filter(TrainingConfig.id == request.config_id).first()
             if config_record:
                 config = config_record.config_json
        
        # Fallback to default if no config provided (or handle error)
        if not config:
             # Try to load default from file if exists, else empty dict
             if os.path.exists(CONFIG_PATH):
                 config = load_config(CONFIG_PATH)
             else:
                 # Minimal config if needed
                 tracking_uri = os.getenv('MLFLOW_TRACKING_URI', 'http://localhost:5000')
                 config = {'mlflow': {'tracking_uri': tracking_uri, 'experiment_name': 'Default'}}
        
        # Override tracking URI from Env if available (Config file might have localhost)
        if os.getenv('MLFLOW_TRACKING_URI'):
             if 'mlflow' not in config: config['mlflow'] = {}
             config['mlflow']['tracking_uri'] = os.getenv('MLFLOW_TRACKING_URI')
        
        # Determine Model URI and Run ID
        model_uri = request.model_uri
        run_id = None
        
        if not model_uri:
            # Try to get the latest run from the experiment
            client = mlflow.tracking.MlflowClient(tracking_uri=config['mlflow']['tracking_uri'])
            experiment = client.get_experiment_by_name(config['mlflow']['experiment_name'])
            if not experiment:
                raise HTTPException(status_code=404, detail="Experiment not found")
            
            runs = client.search_runs(
                experiment_ids=[experiment.experiment_id],
                order_by=["attribute.start_time DESC"],
                max_results=1
            )
            
            if not runs:
                raise HTTPException(status_code=404, detail="No runs found for experiment")
            
            run_id = runs[0].info.run_id
            model_uri = f"runs:/{run_id}/model"
        else:
            # Extract run_id from uri if possible (e.g. runs:/<run_id>/model)
            if model_uri.startswith("runs:/"):
                run_id = model_uri.split("/")[1]

        # Load Model and Preprocessor (Cache them)
        if model_uri not in model_cache:
            logger.info(f"Loading model and preprocessor from {model_uri}...")
            mlflow.set_tracking_uri(config['mlflow']['tracking_uri'])
            
            # Load Model
            model = mlflow.sklearn.load_model(model_uri)
            
            # Load Preprocessor
            preprocessor = None
            try:
                # 1. Try to download custom preprocessing script from artifacts
                if run_id:
                    local_script_path = mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path="code/preprocess.py")
                    logger.info(f"Downloaded custom preprocessing script to: {local_script_path}")
                    
                    # Load class dynamically
                    DataPreprocessorClass = load_class_from_file(local_script_path, 'DataPreprocessor')
                    preprocessor = DataPreprocessorClass()
                else:
                    logger.warning("No run_id, falling back to default preprocessor.")
            except Exception as e:
                logger.warning(f"Could not load custom preprocessor from artifacts: {e}. Falling back to default/config.")
            
            # 2. Fallback to config or default if artifact loading failed
            if preprocessor is None:
                script_path = config.get('preprocessing', {}).get('script_path', 'src/features/preprocess.py')
                logger.info(f"Loading preprocessor from config path: {script_path}")
                try:
                    DataPreprocessorClass = load_class_from_file(script_path, 'DataPreprocessor')
                    preprocessor = DataPreprocessorClass()
                except Exception as e:
                    logger.error(f"Failed to load preprocessor from config: {e}")
                    # Last resort: Import directly (should be covered by dynamic loader but just in case)
                    from src.features.preprocess import DataPreprocessor
                    preprocessor = DataPreprocessor()

            # Load state (scalers, encoders)
            if run_id:
                try:
                    local_path = mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path="preprocessors")
                    preprocessor.load_preprocessors(local_path)
                except Exception as e:
                     logger.warning(f"Could not load preprocessor state: {e}")
            else:
                logger.warning("Run ID not found, skipping preprocessor state loading.")
            
            model_cache[model_uri] = {
                "model": model,
                "preprocessor": preprocessor
            }
        
        cached_assets = model_cache[model_uri]
        model = cached_assets["model"]
        preprocessor = cached_assets["preprocessor"]
        
        # Prepare Data
        df = pd.DataFrame(request.data)
        
        # Handle Days to Predict (Forecasting)
        if request.days_to_predict and request.days_to_predict > 0:
            logger.info(f"Generating forecast for {request.days_to_predict} days...")
            future_data = []
            
            # Check for timestamp column (case-insensitive)
            ts_col = next((col for col in df.columns if col.lower() in ['utc', 'timestamp', 'date', 'time']), None)
            
            last_row = df.iloc[-1].copy()
            
            for i in range(1, request.days_to_predict + 1):
                new_row = last_row.copy()
                if ts_col:
                    # Assume unix timestamp (seconds)
                    try:
                        new_row[ts_col] = int(new_row[ts_col]) + (i * 86400)
                    except:
                        pass # Keep original if not integer
                future_data.append(new_row)
            
            df = pd.DataFrame(future_data)

        # Apply Preprocessing (Flattening -> Scaling)
        if preprocessor:
            try:
                processed_data = preprocessor.preprocess_inference(df)
            except Exception as e:
                logger.error(f"Preprocessing failed: {e}")
                raise HTTPException(status_code=400, detail=f"Preprocessing failed: {str(e)}")
        else:
            processed_data = df
        
        # Predict
        predictions = model.predict(processed_data)
        
        # Inverse Transform Predictions (if target was scaled during training)
        if preprocessor and hasattr(preprocessor, 'target_scaler'):
            try:
                # Check if scaler is fitted (has mean_) to avoid errors on unsupervised/classification
                if hasattr(preprocessor.target_scaler, 'mean_'):
                    predictions = predictions.reshape(-1, 1)
                    predictions = preprocessor.target_scaler.inverse_transform(predictions).flatten()
            except Exception as e:
                logger.warning(f"Could not inverse transform predictions: {e}")
        
        # Save to Database
        try:
            if 'database' in config and 'prediction_table' in config['database']:
                prediction_table = config['database']['prediction_table']
                logger.info(f"Saving predictions to table: {prediction_table}")
                
                # Create results DataFrame
                results_df = df.copy()
                results_df['prediction'] = predictions
                
                from datetime import datetime
                results_df['prediction_time'] = datetime.utcnow()
                
                # Get connector
                from src.data.data_loader import DataLoader
                db_connector = DataLoader.get_connector(config['database']['type'], config['database'])
                db_connector.save_data(results_df, prediction_table)
                db_connector.close()
            else:
                logger.warning("No prediction_table found in config, skipping save to DB.")
        except Exception as e:
            logger.error(f"Failed to save predictions to database: {e}")
            # Don't fail the request if saving fails, just log it
        
        return {
            "model_uri": model_uri,
            "predictions": predictions.tolist(),
            "timestamps": df[ts_col].tolist() if request.days_to_predict and ts_col else None
        }
        
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
