from .base import PipelineStepHandler
from typing import Dict, Any
import mlflow
import mlflow.sklearn
from sklearn.metrics import accuracy_score, mean_squared_error
from src.models.model_factory import ModelFactory
import logging

import os

logger = logging.getLogger(__name__)

class TrainingStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        if 'X_train' not in context:
            raise ValueError("Training data not found in context")
            
        mlflow_config = config.get('mlflow', {})
        model_config = config.get('model', {})
        
        # Prioritize Environment Variable (Docker) > Config File > Default
        tracking_uri = os.getenv('MLFLOW_TRACKING_URI') or mlflow_config.get('tracking_uri', 'http://localhost:5000')
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(mlflow_config.get('experiment_name', 'Default'))
        
        try:
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
                            # Also drop object columns (strings, lists) as they cannot be processed by numeric models without encoding
                            cols_to_drop = df.select_dtypes(include=['datetime', 'datetimetz', '<M8[ns]', 'object']).columns
                            if len(cols_to_drop) > 0:
                                logger.info(f"Dropping non-numeric columns for task ({task_type}): {list(cols_to_drop)}")
                                context[dataset_name] = df.drop(columns=cols_to_drop)
    
                model.fit(context['X_train'], context['y_train'])
                
                # Log Feature Importance (if available)
                if hasattr(model, 'feature_importances_'):
                    try:
                        import json
                        feature_names = context['X_train'].columns.tolist()
                        importances = model.feature_importances_.tolist()
                        feature_importance_dict = dict(zip(feature_names, importances))
                        # Sort by importance
                        sorted_idx = sorted(feature_importance_dict.items(), key=lambda x: x[1], reverse=True)
                        logger.info(f"Top 5 Feature Importances: {sorted_idx[:5]}")
                        
                        # Log as artifact
                        with open("feature_importance.json", "w") as f:
                            json.dump(feature_importance_dict, f)
                        mlflow.log_artifact("feature_importance.json")
                    except Exception as fi_err:
                        logger.warning(f"Failed to log feature importance: {fi_err}")

                # Evaluate
                predictions = model.predict(context['X_test'])
                
                # Basic Metrics
                if task_type == 'classification':
                    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
                    acc = accuracy_score(context['y_test'], predictions)
                    prec = precision_score(context['y_test'], predictions, average='weighted', zero_division=0)
                    rec = recall_score(context['y_test'], predictions, average='weighted', zero_division=0)
                    f1 = f1_score(context['y_test'], predictions, average='weighted', zero_division=0)
                    
                    metrics = {
                        "test_accuracy": acc,
                        "test_precision_weighted": prec,
                        "test_recall_weighted": rec,
                        "test_f1_weighted": f1
                    }
                for k, v in metrics.items():
                    try:
                        mlflow.log_metric(k, v)
                    except Exception as e:
                        logger.warning(f"Failed to log metric {k}: {e}")
                logger.info(f"Classification Metrics: {metrics}")
                else:
                    from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
                    import numpy as np
                    
                    mse = mean_squared_error(context['y_test'], predictions)
                    rmse = np.sqrt(mse)
                    mae = mean_absolute_error(context['y_test'], predictions)
                    r2 = r2_score(context['y_test'], predictions)
                    
                    metrics = {
                        "test_mse": mse,
                        "test_rmse": rmse,
                        "test_mae": mae,
                        "test_r2_score": r2
                    }
                for k, v in metrics.items():
                    try:
                        mlflow.log_metric(k, v)
                    except Exception as e:
                        logger.warning(f"Failed to log metric {k}: {e}")
                logger.info(f"Regression Metrics: {metrics}")
                    
                # Log Model & Preprocessor
                # Note: autolog logs model automatically, but we might want to log it explicitly as 'model' if autolog uses a different name
                # However, autolog usually logs it as 'model'. We can skip manual model logging to avoid duplication if autolog is on.
                # But to be safe and consistent with previous behavior, we keep explicit logging but maybe use a different artifact path if needed.
                # Actually, MLflow handles overwrites typically. Let's keep manual logging to ensure we get exactly what we want.
                if not mlflow.active_run().data.tags.get('mlflow.autologging', None):
                     mlflow.sklearn.log_model(model, "model")
    
                if 'preprocessor' in context:
                    preprocessor = context['preprocessor']
                    
                    # Debugging info
                    logger.info(f"Preprocessor object: {preprocessor}")
                    logger.info(f"Preprocessor type: {type(preprocessor)}")
                    
                    # Handle case where preprocessor is a class (issue #210)
                    if isinstance(preprocessor, type):
                        logger.error("Preprocessor in context is a Class, not an instance! Attempting to instantiate (Warning: Scaler will be empty).")
                        try:
                            preprocessor = preprocessor()
                            context['preprocessor'] = preprocessor # Update context
                        except Exception as e:
                            logger.error(f"Failed to instantiate preprocessor class: {e}")
                            raise ValueError(f"Preprocessor is a class and cannot be instantiated: {e}")
    
                    # Verify method exists
                    if not hasattr(preprocessor, 'save_preprocessors'):
                         logger.error("Preprocessor object missing 'save_preprocessors' method.")
                         raise ValueError(f"Preprocessor object {type(preprocessor)} missing 'save_preprocessors' method.")
    
                    try:
                        preprocessor.save_preprocessors('models/preprocessors')
                        mlflow.log_artifacts('models/preprocessors', artifact_path="preprocessors")
                    except TypeError as e:
                        logger.error(f"Failed to save preprocessors: {e}")
                        import inspect
                        sig = inspect.signature(preprocessor.save_preprocessors)
                        logger.error(f"Expected signature: {sig}")
                        raise e
                    
                context['model'] = model
                context['run_id'] = mlflow.active_run().info.run_id
                logger.info(f"Training completed. Run ID: {context['run_id']}")
        except Exception as e:
             logger.error(f"Training failed: {e}")
             raise e
