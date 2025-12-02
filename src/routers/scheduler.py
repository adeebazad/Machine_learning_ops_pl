from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sys
import os
import subprocess
from typing import List, Optional

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.utils.job_manager import JobManager

router = APIRouter(prefix="/scheduler", tags=["scheduler"])
job_manager = JobManager()

class ScheduleRequest(BaseModel):
    config_path: Optional[str] = None
    pipeline_id: Optional[int] = None
    time: str

@router.get("/jobs")
def get_jobs():
    return {"jobs": job_manager.get_jobs()}

@router.post("/start")
def start_scheduler(request: ScheduleRequest):
    try:
        # Prepare environment
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        cmd = [sys.executable, "src/scheduler.py", "--time", request.time]
        
        if request.pipeline_id:
            cmd.extend(["--pipeline-id", str(request.pipeline_id)])
            job_key = f"Pipeline {request.pipeline_id}"
        elif request.config_path:
            cmd.extend(["--config", request.config_path])
            job_key = request.config_path
        else:
            raise HTTPException(status_code=400, detail="Either config_path or pipeline_id must be provided")

        # Start process
        process = subprocess.Popen(
            cmd,
            env=env,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        
        # Register job
        job = job_manager.add_job(process.pid, job_key, request.time)
        return {"message": "Scheduler started", "job": job}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop/{job_id}")
def stop_scheduler(job_id: int):
    success, msg = job_manager.stop_job(job_id)
    if success:
        return {"message": msg}
    else:
        raise HTTPException(status_code=400, detail=msg)

@router.post("/clear")
def clear_stopped_jobs():
    job_manager.clear_stopped_jobs()
    return {"message": "Stopped jobs cleared"}
