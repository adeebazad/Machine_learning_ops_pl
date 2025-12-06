from .base import PipelineStepHandler
from typing import Dict, Any
import mlflow
import mlflow.sklearn
from sklearn.metrics import accuracy_score, mean_squared_error
from src.models.model_factory import ModelFactory
import logging

logger = logging.getLogger(__name__)

class TrainingStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        if 'X_train' not in context:
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
            context['task_type'] = task_type

            model = ModelFactory.get_model(task_type, model_name, params)
            
            # Fix for switching from Time Series to other models: Drop datetime columns
            if task_type != 'time_series':
                for dataset_name in ['X_train', 'X_test']:
                    if dataset_name in context:
                        df = context[dataset_name]
                        # Drop datetime columns which cause issues for standard sklearn models
                        cols_to_drop = df.select_dtypes(include=['datetime', 'datetimetz', '<M8[ns]']).columns
                        if len(cols_to_drop) > 0:
                            logger.info(f"Dropping datetime columns for non-time-series task ({task_type}): {list(cols_to_drop)}")
                            context[dataset_name] = df.drop(columns=cols_to_drop)

            model.fit(context['X_train'], context['y_train'])
            
            # Evaluate
            predictions = model.predict(context['X_test'])
            if task_type == 'classification':
                acc = accuracy_score(context['y_test'], predictions)
                mlflow.log_metric("accuracy", acc)
                logger.info(f"Model Accuracy: {acc}")
            else:
                mse = mean_squared_error(context['y_test'], predictions)
                mlflow.log_metric("mse", mse)
                logger.info(f"Model MSE: {mse}")
                
            # Log Model & Preprocessor
            mlflow.sklearn.log_model(model, "model")
            if 'preprocessor' in context:
                context['preprocessor'].save_preprocessors('models/preprocessors')
                mlflow.log_artifacts('models/preprocessors', artifact_path="preprocessors")
                
            context['model'] = model
            context['run_id'] = mlflow.active_run().info.run_id
            logger.info(f"Training completed. Run ID: {context['run_id']}")
