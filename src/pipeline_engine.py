import pandas as pd
import json
import os
import mlflow
import mlflow.sklearn
from datetime import datetime
from sqlalchemy.orm import Session
from src.infrastructure.database import get_db
from src.infrastructure.models import Pipeline, PipelineStep, PipelineRun, TrainingConfig
from src.data.data_loader import DataLoader
from src.utils.dynamic_loader import load_class_from_file
from src.models.model_factory import ModelFactory
from src.utils.logger import setup_logger
from sklearn.metrics import accuracy_score, mean_squared_error, r2_score
from src.pipeline.steps.extraction import ExtractionStep
from src.pipeline.steps.preprocessing import PreprocessingStep
from src.pipeline.steps.training import TrainingStep
from src.pipeline.steps.prediction import PredictionStep
from src.pipeline.steps.save import SaveStep

logger = setup_logger(__name__)

class PipelineEngine:
    def __init__(self, pipeline_id: int):
        self.pipeline_id = pipeline_id
        self.db: Session = next(get_db())
        self.run_record = None
        self.context = {} # Store data between steps

    def _log(self, message: str):
        logger.info(message)
        if self.run_record:
            current_logs = self.run_record.logs or ""
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            self.run_record.logs = current_logs + f"[{timestamp}] {message}\n"
            self.db.commit()

    def run(self, run_id: int):
        # Fetch existing Run Record
        self.run_record = self.db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
        if not self.run_record:
            logger.error(f"PipelineRun {run_id} not found")
            return

        self.run_record.status = "running"
        self.run_record.logs = "Starting pipeline execution...\n"
        self.db.commit()
        self.db.refresh(self.run_record)

        try:
            pipeline = self.db.query(Pipeline).filter(Pipeline.id == self.pipeline_id).first()
            if not pipeline:
                raise ValueError(f"Pipeline {self.pipeline_id} not found")

            steps = sorted(pipeline.steps, key=lambda x: x.order)
            
            for step in steps:
                self._log(f"Executing step: {step.name} ({step.step_type})")
                self._execute_step(step)
            
            self.run_record.status = "completed"
            self.run_record.completed_at = datetime.utcnow()
            self._log("Pipeline execution completed successfully.")
            self.db.commit()
            return self.run_record.id

        except Exception as e:
            self.run_record.status = "failed"
            self.run_record.completed_at = datetime.utcnow()
            self._log(f"Pipeline failed: {str(e)}")
            self.db.commit()
            raise e
        finally:
            self.db.close()

    def _execute_step(self, step: PipelineStep):
        config = step.config_json
        handler = None

        if step.step_type == "extraction":
            handler = ExtractionStep()
        elif step.step_type == "preprocessing":
            handler = PreprocessingStep()
        elif step.step_type == "training":
            handler = TrainingStep()
        elif step.step_type == "prediction":
            handler = PredictionStep()
        elif step.step_type == "save":
            handler = SaveStep()
        else:
            raise ValueError(f"Unknown step type: {step.step_type}")
        
        self._log(f"Executing step: {step.name} ({step.step_type})")
        handler.execute(self.context, config)


class StepExecutor:
    def __init__(self, pipeline_id: int):
        self.pipeline_id = pipeline_id
        self.db: Session = next(get_db())
        self.cache_dir = "cache"
        import os
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_path(self, step_order: int):
        import os
        return os.path.join(self.cache_dir, f"pipeline_{self.pipeline_id}_step_{step_order}.joblib")

    def run_step(self, step_order: int, step_override: dict = None):
        import joblib
        import os
        from types import SimpleNamespace
        
        # Load pipeline
        pipeline = self.db.query(Pipeline).filter(Pipeline.id == self.pipeline_id).first()
        if not pipeline:
            raise ValueError("Pipeline not found")
        
        step = None
        if step_override:
            # Create a mock step object from the override
            step = SimpleNamespace(
                name=step_override.get('name', 'Test Step'),
                step_type=step_override.get('step_type'),
                order=step_order,
                config_json=step_override.get('config_json', {})
            )
        else:
            step = next((s for s in pipeline.steps if s.order == step_order), None)
        
        if not step:
            raise ValueError("Step not found")

        # Load context from previous step
        context = {}
        if step_order > 0:
            prev_cache = self._get_cache_path(step_order - 1)
            if os.path.exists(prev_cache):
                context = joblib.load(prev_cache)
            else:
                # If previous cache doesn't exist, maybe we can try to load from -2? 
                # For now, strict dependency.
                if step.step_type != "extraction": # Extraction doesn't need input
                     raise ValueError("Previous step output not found. Please run previous steps first.")
        
        # Initialize Engine with context
        engine = PipelineEngine(self.pipeline_id)
        engine.context = context
        
        # Execute
        engine._execute_step(step)
        
        # Save context
        joblib.dump(engine.context, self._get_cache_path(step_order))
        
        # Generate Preview
        return self._generate_preview(step.step_type, engine.context)

    def _generate_preview(self, step_type, context):
        if step_type in ["extraction", "preprocessing"]:
            if "data" in context:
                df = context["data"]
                # Convert to dict for JSON response
                # Handle NaN/Infinity for JSON
                # CRITICAL: Return sufficient data for analytics (5000 rows)
                data_preview = json.loads(df.head(5000).fillna(0).to_json(orient="records", date_format="iso"))
                return {
                    "type": "table",
                    "rows": len(df),
                    "columns": list(df.columns),
                    "data": data_preview
                }
        elif step_type == "training":
            # We can try to extract metrics if they were logged or stored
            # For now, return a success message
            return {
                "type": "json", 
                "data": {
                    "message": "Training completed successfully.",
                    "run_id": context.get("run_id"),
                    "model_type": type(context.get("model")).__name__ if "model" in context else "Unknown"
                }
            }
        elif step_type == "prediction":
            if "data" in context:
                df = context["data"]
                # CRITICAL: Return sufficient data for analytics (5000 rows)
                data_preview = json.loads(df.head(5000).fillna(0).to_json(orient="records", date_format="iso"))
                return {
                    "type": "table",
                    "rows": len(df),
                    "columns": list(df.columns),
                    "data": data_preview
                }
            
        return {"type": "text", "data": "Step completed successfully."}
