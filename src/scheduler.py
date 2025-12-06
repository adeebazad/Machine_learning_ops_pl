import threading
import time
import datetime
from sqlalchemy.orm import Session
from src.infrastructure.database import SessionLocal
from src.infrastructure.models import Pipeline, PipelineRun
from src.routers.pipelines import run_pipeline_task
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

class PipelineScheduler:
    def __init__(self):
        self.running = False
        self.thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info("Pipeline Scheduler started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        logger.info("Pipeline Scheduler stopped.")

    def _run_loop(self):
        while self.running:
            try:
                self._check_schedules()
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
            
            # Sleep for 5 seconds
            for _ in range(5):
                if not self.running:
                    break
                time.sleep(1)

    def _check_schedules(self):
        db = SessionLocal()
        try:
            # Get all enabled pipelines
            # SQLite stores booleans as 0/1
            pipelines = db.query(Pipeline).filter(Pipeline.schedule_enabled == 1).all()
            
            now = datetime.datetime.utcnow()
            current_time_str = now.strftime("%H:%M")
            
            for pipeline in pipelines:
                if pipeline.schedule_interval and pipeline.schedule_interval > 0:
                    # Interval Based Scheduling
                    should_run = False
                    if not pipeline.last_run:
                        should_run = True
                    else:
                        # Check if enough time has passed
                        elapsed = (now - pipeline.last_run).total_seconds()
                        if elapsed >= pipeline.schedule_interval:
                            should_run = True
                
                elif pipeline.schedule_time:
                    # Time Based Scheduling (Daily)
                    if pipeline.schedule_time == current_time_str:
                        should_run = False
                        if not pipeline.last_run:
                            should_run = True
                        else:
                            # Check if last run was today
                            if pipeline.last_run.date() < now.date():
                                should_run = True
                            pass
                else:
                    should_run = False

                    if should_run:
                        logger.info(f"Triggering scheduled run for pipeline {pipeline.id} ({pipeline.name}) at {current_time_str}")
                        self._trigger_pipeline(db, pipeline)
                        
        finally:
            db.close()

    def _trigger_pipeline(self, db: Session, pipeline: Pipeline):
        # Create run record
        run_record = PipelineRun(pipeline_id=pipeline.id, status="pending")
        db.add(run_record)
        
        # Update last_run
        pipeline.last_run = datetime.datetime.utcnow()
        
        db.commit()
        db.refresh(run_record)
        
        # Run task (in a separate thread to not block scheduler)
        # We can use the same function as the API
        threading.Thread(target=run_pipeline_task, args=(pipeline.id, run_record.id)).start()

# Global instance
scheduler = PipelineScheduler()
