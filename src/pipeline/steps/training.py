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
        logger.info(f"Using MLflow Tracking URI: {tracking_uri}")
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(mlflow_config.get('experiment_name', 'Default'))
        
        try:
            # Explicitly disable autologging to prevent implicit behavior
            mlflow.sklearn.autolog(disable=True)
            
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
    
                if task_type in ['clustering', 'anomaly_detection', 'unsupervised']:
                    logger.info(f"Training Unsupervised Model ({task_type})...")
                    if hasattr(model, 'fit_predict'):
                        # some models like DBSCAN don't have a separate predict for new data easily, but fit_predict works
                         model.fit(context['X_train'])
                    else:
                         model.fit(context['X_train'])
                else:
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
                    if context.get('y_test') is not None:
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
                    else:
                        logger.info("Skipping classification metrics: y_test is None (Unsupervised/Rule-Based).")
                        metrics = {}
                elif task_type in ['clustering', 'anomaly_detection', 'unsupervised']:
                     from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
                     
                     # Check if we have enough samples and if labels are generated
                     # For some models (DBSCAN), predictions might be -1 (noise)
                     if hasattr(model, 'labels_'):
                         labels = model.labels_
                         # If we used X_test for prediction, we should evaluate on that.
                         # But clustering usually evaluates directly on the data it was effectively 'predicted' on.
                         # If model.predict exists, we use predictions from X_test.
                         if hasattr(model, 'predict'):
                             eval_data = context['X_test']
                             eval_labels = predictions
                         else:
                             # For transductive estimators like DBSCAN (no predict method usually), 
                             # we might have to rely on training labels, or skip test eval.
                             # Let's assume we use training data for evaluation if no predict
                             eval_data = context['X_train']
                             eval_labels = labels
                     else:
                         eval_data = context['X_test']
                         eval_labels = predictions
                         
                     # Metrics require > 1 unique label
                     unique_labels = set(eval_labels)
                     if len(unique_labels) > 1:
                         sil = silhouette_score(eval_data, eval_labels)
                         db = davies_bouldin_score(eval_data, eval_labels)
                         ch = calinski_harabasz_score(eval_data, eval_labels)
                         
                         metrics = {
                             "silhouette_score": sil,
                             "davies_bouldin_score": db,
                             "calinski_harabasz_score": ch,
                             "n_clusters": len(unique_labels) - (1 if -1 in unique_labels else 0)
                         }
                     else:
                         metrics = {"n_clusters": len(unique_labels)}
                         logger.warning("Clustering resulted in only 1 cluster (or only noise). Skipping score calc.")

                else:
                    if context.get('y_test') is not None:
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
                    else:
                        logger.info("Skipping regression metrics: y_test is None.")
                        metrics = {}
                
                # Log metrics common block
                for k, v in metrics.items():
                    try:
                        # Sanitize: Skip NaN or Infinite values
                        import math
                        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                            logger.warning(f"Skipping NaN/Inf metric {k}")
                            continue
                        mlflow.log_metric(k, v)
                    except Exception as e:
                        logger.warning(f"Failed to log metric {k}: {e}")
                
                logger.info(f"{task_type.capitalize()} Metrics: {metrics}")
                    
                # Log Model & Preprocessor
                # Note: autolog logs model automatically, but we might want to log it explicitly as 'model' if autolog uses a different name
                # However, autolog usually logs it as 'model'. We can skip manual model logging to avoid duplication if autolog is on.
                # But to be safe and consistent with previous behavior, we keep explicit logging but maybe use a different artifact path if needed.
                # Actually, MLflow handles overwrites typically. Let's keep manual logging to ensure we get exactly what we want.
                if not mlflow.active_run().data.tags.get('mlflow.autologging', None):
                     try:
                         mlflow.sklearn.log_model(model, "model")
                     except Exception as e:
                         logger.warning(f"Failed to log model: {e}")
    
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
                    
                if 'correlation_matrix_path' in context:
                    try:
                        mlflow.log_artifact(context['correlation_matrix_path'])
                        logger.info(f"Logged correlation matrix artifact from {context['correlation_matrix_path']}")
                    except Exception as e:
                        logger.warning(f"Failed to log correlation matrix artifact: {e}")

                context['model'] = model
                context['run_id'] = mlflow.active_run().info.run_id
                logger.info(f"Training completed. Run ID: {context['run_id']}")
        except Exception as e:
             logger.error(f"Training failed: {e}")
             raise e
