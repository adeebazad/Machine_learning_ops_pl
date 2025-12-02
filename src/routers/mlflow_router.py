from fastapi import APIRouter, HTTPException
import mlflow
from typing import List, Dict, Any
import os
import yaml

router = APIRouter(prefix="/mlflow", tags=["mlflow"])

CONFIG_PATH = "config/config.yaml"

def get_mlflow_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f)
            return config.get('mlflow', {})
    return {}

@router.get("/experiments")
def list_experiments():
    config = get_mlflow_config()
    if 'tracking_uri' in config:
        mlflow.set_tracking_uri(config['tracking_uri'])
    
    try:
        experiments = mlflow.search_experiments()
        return {"experiments": [
            {
                "id": exp.experiment_id,
                "name": exp.name,
                "artifact_location": exp.artifact_location,
                "lifecycle_stage": exp.lifecycle_stage
            } for exp in experiments
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/runs/{experiment_id}")
def list_runs(experiment_id: str):
    config = get_mlflow_config()
    if 'tracking_uri' in config:
        mlflow.set_tracking_uri(config['tracking_uri'])
        
    try:
        runs = mlflow.search_runs(experiment_ids=[experiment_id], order_by=["attribute.start_time DESC"])
        # Convert pandas DF to list of dicts
        if runs.empty:
            return {"runs": []}
        
        # Select relevant columns and handle NaNs
        runs = runs.fillna("")
        return {"runs": runs.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
