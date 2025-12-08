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
                should_run = False
                if pipeline.schedule_interval and pipeline.schedule_interval > 0:
                    # Interval Based Scheduling
                    should_run = False
                    if not pipeline.last_run:
                        logger.info(f"Pipeline {pipeline.id} has no last_run. Scheduling immediately.")
                        should_run = True
                    else:
                        # Check if enough time has passed
                        elapsed = (now - pipeline.last_run).total_seconds()
                        logger.debug(f"Pipeline {pipeline.id}: elapsed={elapsed}, interval={pipeline.schedule_interval}")
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

    def _trigger_pipeline(self, db: Session, pipeline_obj: Pipeline):
        from src.tasks import execute_pipeline_task
        try:
            # 1. Refetch pipeline to ensure it's attached to this session and locked if possible
            # (SQLite doesn't support for update, but fresh get is safer)
            pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_obj.id).first()
            if not pipeline:
                logger.error(f"Pipeline {pipeline_obj.id} not found in DB execution context.")
                return

            # 2. Create run record
            run_record = PipelineRun(pipeline_id=pipeline.id, status="pending")
            db.add(run_record)
            
            # 3. Update last_run
            pipeline.last_run = datetime.datetime.utcnow()
            db.add(pipeline) 
            
            # 4. Commit transaction
            db.commit()
            logger.info(f"Successfully triggered pipeline {pipeline.id}. Updated last_run to {pipeline.last_run}")
            
            # 5. Dispatch to Celery
            db.refresh(run_record)
            # Use execute_pipeline_task.delay() for distributed execution
            execute_pipeline_task.delay(pipeline.id, run_record.id)
            logger.info(f"Dispatched pipeline {pipeline.id} run {run_record.id} to Celery worker.")
            
        except Exception as e:
            logger.error(f"Failed to trigger pipeline {pipeline_obj.id}: {e}")
            db.rollback()

# Global instance
scheduler = PipelineScheduler()
