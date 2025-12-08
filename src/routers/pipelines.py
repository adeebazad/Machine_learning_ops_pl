from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
from src.infrastructure.database import get_db
from src.infrastructure.models import Pipeline, PipelineStep, PipelineRun
from src.pipeline_engine import PipelineEngine

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

# Pydantic Models
class PipelineStepCreate(BaseModel):
    name: str
    step_type: str
    order: int
    config_json: Dict[str, Any]

class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule_enabled: Optional[bool] = False
    schedule_time: Optional[str] = None
    schedule_interval: Optional[int] = None # Hours
    steps: List[PipelineStepCreate]

class PipelineResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    schedule_enabled: Optional[bool]
    schedule_time: Optional[str]
    schedule_interval: Optional[int]
    last_run: Optional[datetime]
    created_at: datetime
    class Config:
        orm_mode = True

class PipelineDetailResponse(PipelineResponse):
    steps: List[Dict[str, Any]] # Simplified for now

class PipelineRunResponse(BaseModel):
    id: int
    pipeline_id: int
    status: str
    logs: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    class Config:
        orm_mode = True

# Endpoints

@router.post("/", response_model=PipelineResponse)
def create_pipeline(pipeline: PipelineCreate, db: Session = Depends(get_db)):
    try:
        # SQLite stores booleans as integers
        sched_enabled = 1 if pipeline.schedule_enabled else 0
        
        db_pipeline = Pipeline(
            name=pipeline.name, 
            description=pipeline.description,
            schedule_enabled=sched_enabled,
            schedule_time=pipeline.schedule_time,
            schedule_interval=pipeline.schedule_interval
        )
        db.add(db_pipeline)
        db.commit()
        db.refresh(db_pipeline)
        
        for step in pipeline.steps:
            db_step = PipelineStep(
                pipeline_id=db_pipeline.id,
                name=step.name,
                step_type=step.step_type,
                order=step.order,
                config_json=step.config_json
            )
            db.add(db_step)
        
        db.commit()
        return db_pipeline
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A pipeline with this name already exists.")
    except Exception as e:
        db.rollback()
        print(f"Error creating pipeline: {e}") # Simple print for now, ideally use logger
        raise HTTPException(status_code=500, detail=f"Failed to create pipeline: {str(e)}")

@router.get("/", response_model=List[PipelineResponse])
def list_pipelines(db: Session = Depends(get_db)):
    return db.query(Pipeline).all()

@router.get("/{pipeline_id}", response_model=PipelineDetailResponse)
def get_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # Manually construct response to handle steps
    steps = []
    for step in sorted(pipeline.steps, key=lambda x: x.order):
        steps.append({
            "id": step.id,
            "name": step.name,
            "step_type": step.step_type,
            "order": step.order,
            "config_json": step.config_json
        })
        
    return {
        "id": pipeline.id,
        "name": pipeline.name,
        "description": pipeline.description,
        "schedule_enabled": bool(pipeline.schedule_enabled),
        "schedule_time": pipeline.schedule_time,
        "schedule_interval": pipeline.schedule_interval,
        "last_run": pipeline.last_run,
        "created_at": pipeline.created_at,
        "steps": steps
    }

@router.delete("/{pipeline_id}")
def delete_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    db.delete(pipeline)
    db.commit()
    return {"message": "Pipeline deleted"}

@router.put("/{pipeline_id}", response_model=PipelineResponse)
def update_pipeline(pipeline_id: int, pipeline_update: PipelineCreate, db: Session = Depends(get_db)):
    try:
        db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
        if not db_pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        # Update basic fields
        db_pipeline.name = pipeline_update.name
        db_pipeline.description = pipeline_update.description
        db_pipeline.schedule_enabled = 1 if pipeline_update.schedule_enabled else 0
        db_pipeline.schedule_time = pipeline_update.schedule_time
        db_pipeline.schedule_interval = pipeline_update.schedule_interval
        
        # Delete existing steps
        db.query(PipelineStep).filter(PipelineStep.pipeline_id == pipeline_id).delete()
        
        # Add new steps
        for step in pipeline_update.steps:
            db_step = PipelineStep(
                pipeline_id=db_pipeline.id,
                name=step.name,
                step_type=step.step_type,
                order=step.order,
                config_json=step.config_json
            )
            db.add(db_step)
            
        db.commit()
        db.refresh(db_pipeline)
        return db_pipeline
    except Exception as e:
        db.rollback()
        print(f"Error updating pipeline: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update pipeline: {str(e)}")

# Execution

def run_pipeline_task(pipeline_id: int, run_id: int):
    engine = PipelineEngine(pipeline_id)
    engine.run(run_id)

from src.tasks import execute_pipeline_task

# ... 

@router.post("/{pipeline_id}/run", response_model=Dict[str, Any])
def run_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # Create run record immediately to return ID
    run_record = PipelineRun(pipeline_id=pipeline_id, status="pending")
    db.add(run_record)
    db.commit()
    db.refresh(run_record)
    
    # Dispatch to Celery
    execute_pipeline_task.delay(pipeline_id, run_record.id)
    
    return {"message": "Pipeline execution started (Celery)", "run_id": run_record.id}

@router.get("/{pipeline_id}/runs", response_model=List[PipelineRunResponse])
def list_pipeline_runs(pipeline_id: int, db: Session = Depends(get_db)):
    return db.query(PipelineRun).filter(PipelineRun.pipeline_id == pipeline_id).order_by(PipelineRun.created_at.desc()).all()

@router.post("/{pipeline_id}/steps/{order}/test")
def test_pipeline_step(pipeline_id: int, order: int, step_def: Dict[str, Any] = None, db: Session = Depends(get_db)):
    from src.pipeline_engine import StepExecutor
    try:
        executor = StepExecutor(pipeline_id)
        result = executor.run_step(order, step_override=step_def)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
