from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
from src.infrastructure.database import get_db, engine, Base
from src.infrastructure.models import Experiment, TrainingConfig, TrainingJob

# Create tables
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/experiments", tags=["experiments"])

# Pydantic Models
class ExperimentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ExperimentResponse(ExperimentCreate):
    id: int
    created_at: datetime
    class Config:
        orm_mode = True

class ConfigCreate(BaseModel):
    name: str
    config_json: Dict[str, Any]

class ConfigResponse(ConfigCreate):
    id: int
    experiment_id: int
    created_at: datetime
    class Config:
        orm_mode = True

class JobResponse(BaseModel):
    id: int
    experiment_id: int
    config_id: int
    status: str
    mlflow_run_id: Optional[str]
    created_at: datetime
    class Config:
        orm_mode = True

# --- Experiment Endpoints ---

@router.post("/", response_model=ExperimentResponse)
def create_experiment(experiment: ExperimentCreate, db: Session = Depends(get_db)):
    db_experiment = db.query(Experiment).filter(Experiment.name == experiment.name).first()
    if db_experiment:
        raise HTTPException(status_code=400, detail="Experiment with this name already exists")
    
    new_experiment = Experiment(name=experiment.name, description=experiment.description)
    db.add(new_experiment)
    db.commit()
    db.refresh(new_experiment)
    return new_experiment

@router.get("/", response_model=List[ExperimentResponse])
def list_experiments(db: Session = Depends(get_db)):
    return db.query(Experiment).all()

@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment

# --- Config Endpoints ---

@router.post("/{experiment_id}/configs", response_model=ConfigResponse)
def create_config(experiment_id: int, config: ConfigCreate, db: Session = Depends(get_db)):
    # Verify experiment exists
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    new_config = TrainingConfig(
        experiment_id=experiment_id,
        name=config.name,
        config_json=config.config_json
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    return new_config

@router.get("/{experiment_id}/configs", response_model=List[ConfigResponse])
def list_configs(experiment_id: int, db: Session = Depends(get_db)):
    return db.query(TrainingConfig).filter(TrainingConfig.experiment_id == experiment_id).all()

@router.get("/configs/{config_id}", response_model=ConfigResponse)
def get_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(TrainingConfig).filter(TrainingConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@router.put("/configs/{config_id}", response_model=ConfigResponse)
def update_config(config_id: int, config: ConfigCreate, db: Session = Depends(get_db)):
    db_config = db.query(TrainingConfig).filter(TrainingConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    db_config.name = config.name
    db_config.config_json = config.config_json
    db.commit()
    db.refresh(db_config)
    return db_config

# --- Job Endpoints (History) ---

@router.get("/{experiment_id}/jobs", response_model=List[JobResponse])
def list_jobs(experiment_id: int, db: Session = Depends(get_db)):
    return db.query(TrainingJob).filter(TrainingJob.experiment_id == experiment_id).all()
