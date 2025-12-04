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
        
        if step.step_type == "extraction":
            self._step_extraction(config)
        elif step.step_type == "preprocessing":
            self._step_preprocessing(config)
        elif step.step_type == "training":
            self._step_training(config)
        elif step.step_type == "prediction":
            self._step_prediction(config)
        elif step.step_type == "save":
            self._step_save(config)
        else:
            raise ValueError(f"Unknown step type: {step.step_type}")

    def _step_extraction(self, config):
        db_config = config.get('database')
        query = config.get('query')
        if not db_config or not query:
            raise ValueError("Extraction step requires 'database' config and 'query'")
        
        connector = DataLoader.get_connector(db_config['type'], db_config)
        df = connector.fetch_data(query)
        connector.close()
        
        self.context['data'] = df
        self._log(f"Extracted {len(df)} rows.")

    def _step_preprocessing(self, config):
        if 'data' not in self.context:
            raise ValueError("No data found in context for preprocessing")
        
        df = self.context['data']
        script_path = config.get('script_path', 'src/features/preprocess.py')
        target_col = config.get('target_col')
        
        # Auto-create script if it doesn't exist
        if not os.path.exists(script_path):
            self._log(f"Preprocessing script not found at {script_path}. Creating default template.")
            try:
                os.makedirs(os.path.dirname(script_path), exist_ok=True)
                with open(script_path, 'w') as f:
                    f.write('''import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from typing import Tuple, Any
import joblib
import os

class DataPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()

    def preprocess_train(self, df: pd.DataFrame, target_col: str) -> Tuple[Any, Any, Any, Any]:
        """
        Preprocesses training data: splits into X/y, scales features, encodes target.
        """
        # Basic implementation: Drop target, scale numerics, encode target
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        # Select numerical columns
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        # Scale
        X_scaled = X.copy()
        X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        
        # Encode target
        y_encoded = self.label_encoder.fit_transform(y)

        return train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        """
        Preprocesses inference data using fitted scaler.
        """
        numerical_cols = df.select_dtypes(include=['number']).columns
        return self.scaler.transform(df[numerical_cols])

    def save_preprocessors(self, path: str):
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.label_encoder, os.path.join(path, 'label_encoder.joblib'))

    def load_preprocessors(self, path: str):
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
        self.label_encoder = joblib.load(os.path.join(path, 'label_encoder.joblib'))
''')
            except Exception as e:
                self._log(f"Failed to create default preprocessing script: {e}")
                raise ValueError(f"Script not found and failed to create default: {e}")

        DataPreprocessorClass = load_class_from_file(script_path, 'DataPreprocessor')
        preprocessor = DataPreprocessorClass()
        
        if target_col:
            # Training mode preprocessing
            X_train, X_test, y_train, y_test = preprocessor.preprocess_train(df, target_col)
            self.context['X_train'] = X_train
            self.context['X_test'] = X_test
            self.context['y_train'] = y_train
            self.context['y_test'] = y_test
            self.context['preprocessor'] = preprocessor
            self._log("Preprocessing completed (Train/Test split).")
        else:
            # Inference mode preprocessing
            processed_data = preprocessor.preprocess_inference(df)
            self.context['data'] = processed_data
            self._log("Preprocessing completed (Inference mode).")

    def _step_training(self, config):
        if 'X_train' not in self.context:
            raise ValueError("Training data not found in context")
            
        mlflow_config = config.get('mlflow', {})
        model_config = config.get('model', {})
        
        mlflow.set_tracking_uri(mlflow_config.get('tracking_uri', 'http://localhost:5000'))
        mlflow.set_experiment(mlflow_config.get('experiment_name', 'Default'))
        
        with mlflow.start_run():
            # Log params
            mlflow.log_params(model_config.get('params', {}))
            
            # Train
            task_type = model_config.get('task_type', 'classification')
            model_name = model_config.get('name', 'RandomForestClassifier')
            params = model_config.get('params', {})
            
            # Save task type to context for prediction step
            self.context['task_type'] = task_type

            model = ModelFactory.get_model(task_type, model_name, params)
            
            # Fix for switching from Time Series to other models: Drop datetime columns
            if task_type != 'time_series':
                for dataset_name in ['X_train', 'X_test']:
                    if dataset_name in self.context:
                        df = self.context[dataset_name]
                        # Drop datetime columns which cause issues for standard sklearn models
                        cols_to_drop = df.select_dtypes(include=['datetime', 'datetimetz', '<M8[ns]']).columns
                        if len(cols_to_drop) > 0:
                            self._log(f"Dropping datetime columns for non-time-series task ({task_type}): {list(cols_to_drop)}")
                            self.context[dataset_name] = df.drop(columns=cols_to_drop)

            model.fit(self.context['X_train'], self.context['y_train'])
            
            # Evaluate
            predictions = model.predict(self.context['X_test'])
            if task_type == 'classification':
                acc = accuracy_score(self.context['y_test'], predictions)
                mlflow.log_metric("accuracy", acc)
                self._log(f"Model Accuracy: {acc}")
            else:
                mse = mean_squared_error(self.context['y_test'], predictions)
                mlflow.log_metric("mse", mse)
                self._log(f"Model MSE: {mse}")
                
            # Log Model & Preprocessor
            mlflow.sklearn.log_model(model, "model")
            if 'preprocessor' in self.context:
                self.context['preprocessor'].save_preprocessors('models/preprocessors')
                mlflow.log_artifacts('models/preprocessors', artifact_path="preprocessors")
                
            self.context['model'] = model
            self.context['run_id'] = mlflow.active_run().info.run_id
            self._log(f"Training completed. Run ID: {self.context['run_id']}")

    def _step_prediction(self, config):
        data_to_predict = None
        used_test_set = False

        # Priority 1: If X_test is available (from immediate training step), use it.
        if 'X_test' in self.context:
             data_to_predict = self.context['X_test']
             used_test_set = True
             self._log("Using X_test from training for prediction.")
             
        # Priority 2: Use context['data'] (but might need preprocessing)
        elif 'data' in self.context:
             data_to_predict = self.context['data']
             if 'preprocessor' in self.context:
                 self._log("Applying preprocessor to input data.")
                 try:
                     # Try to use preprocess_inference if available
                     if hasattr(self.context['preprocessor'], 'preprocess_inference'):
                        data_to_predict = self.context['preprocessor'].preprocess_inference(data_to_predict)
                     # Fallback to transform if preprocess_inference is not there but transform is
                     elif hasattr(self.context['preprocessor'], 'transform'):
                        data_to_predict = self.context['preprocessor'].transform(data_to_predict)
                 except Exception as e:
                     self._log(f"Preprocessing failed: {str(e)}")
                     # Continue and hope model handles raw data? Or fail?
                     # Let's fail if preprocessing was attempted and failed
                     raise ValueError(f"Preprocessing failed: {str(e)}")
        
        if data_to_predict is None:
            raise ValueError("Data not found for prediction")
            
        model_uri = config.get('model_uri')
        if not model_uri and 'run_id' in self.context:
            model_uri = f"runs:/{self.context['run_id']}/model"
            
        if not model_uri:
             raise ValueError("No model URI provided or found in context")
             
        # Load model
        if 'model' in self.context:
            model = self.context['model']
        else:
            model = mlflow.sklearn.load_model(model_uri)
            
        # Fix for non-time-series models: Drop datetime columns from prediction data
        task_type = self.context.get('task_type')
        if task_type and task_type != 'time_series':
             if isinstance(data_to_predict, pd.DataFrame):
                 cols_to_drop = data_to_predict.select_dtypes(include=['datetime', 'datetimetz', '<M8[ns]']).columns
                 if len(cols_to_drop) > 0:
                     self._log(f"Dropping datetime columns for prediction ({task_type}): {list(cols_to_drop)}")
                     data_to_predict = data_to_predict.drop(columns=cols_to_drop)
            
        predictions = model.predict(data_to_predict)
        
        # Attach predictions to data
        result_df = None
        
        if used_test_set:
            # If we used X_test, it's already a DataFrame (likely scaled)
            if isinstance(data_to_predict, pd.DataFrame):
                result_df = data_to_predict.copy()
            else:
                result_df = pd.DataFrame(data_to_predict)
        else:
            # If we used inference mode, we want to attach predictions to the ORIGINAL data
            # context['data'] holds the original data before preprocessing (for this step)
            if 'data' in self.context and len(self.context['data']) == len(predictions):
                result_df = self.context['data'].copy()
            else:
                # Fallback if lengths don't match or data missing
                if isinstance(data_to_predict, pd.DataFrame):
                    result_df = data_to_predict.copy()
                else:
                    result_df = pd.DataFrame(data_to_predict)
        
        result_df['prediction'] = predictions
        result_df['prediction_time'] = datetime.utcnow()
        
        if 'run_id' in self.context:
            result_df['run_id'] = self.context['run_id']
            
        result_df['model_type'] = type(model).__name__
        
        self.context['data'] = result_df
        self._log("Prediction completed.")

    def _step_save(self, config):
        if 'data' not in self.context:
             raise ValueError("No data to save")
             
        db_config = config.get('database')
        table_name = config.get('table_name')
        
        if not db_config or not table_name:
            raise ValueError("Save step requires 'database' config and 'table_name'")
            
        connector = DataLoader.get_connector(db_config['type'], db_config)
        connector.save_data(self.context['data'], table_name)
        connector.close()
        
        self._log(f"Saved {len(self.context['data'])} rows to {table_name}.")

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
                data_preview = json.loads(df.head(5).to_json(orient="records", date_format="iso"))
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
                data_preview = json.loads(df.head(5).to_json(orient="records", date_format="iso"))
                return {
                    "type": "table",
                    "rows": len(df),
                    "columns": list(df.columns),
                    "data": data_preview
                }
            
        return {"type": "text", "data": "Step completed successfully."}
