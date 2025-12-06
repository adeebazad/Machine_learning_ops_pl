from .base import PipelineStepHandler
from typing import Dict, Any
import mlflow.sklearn
import pandas as pd
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class PredictionStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        data_to_predict = None
        used_test_set = False

        # Priority 1: If X_test is available (from immediate training step), use it.
        if 'X_test' in context:
             data_to_predict = context['X_test']
             used_test_set = True
             logger.info("Using X_test from training for prediction.")
             
        # Priority 2: Use context['data'] (but might need preprocessing)
        elif 'data' in context:
             data_to_predict = context['data']
             if 'preprocessor' in context:
                 logger.info("Applying preprocessor to input data.")
                 try:
                     # Try to use preprocess_inference if available
                     if hasattr(context['preprocessor'], 'preprocess_inference'):
                        data_to_predict = context['preprocessor'].preprocess_inference(data_to_predict)
                     # Fallback to transform if preprocess_inference is not there but transform is
                     elif hasattr(context['preprocessor'], 'transform'):
                        data_to_predict = context['preprocessor'].transform(data_to_predict)
                 except Exception as e:
                     logger.error(f"Preprocessing failed: {str(e)}")
                     raise ValueError(f"Preprocessing failed: {str(e)}")
        
        if data_to_predict is None:
            raise ValueError("Data not found for prediction")
            
        model_uri = config.get('model_uri')
        if not model_uri and 'run_id' in context:
            model_uri = f"runs:/{context['run_id']}/model"
            
        if not model_uri:
             raise ValueError("No model URI provided or found in context")
             
        # Load model
        if 'model' in context:
            model = context['model']
        else:
            model = mlflow.sklearn.load_model(model_uri)
            
        # Fix for non-time-series models: Drop datetime columns from prediction data
        task_type = context.get('task_type')
        if task_type and task_type != 'time_series':
             if isinstance(data_to_predict, pd.DataFrame):
                 cols_to_drop = data_to_predict.select_dtypes(include=['datetime', 'datetimetz', '<M8[ns]']).columns
                 if len(cols_to_drop) > 0:
                     logger.info(f"Dropping datetime columns for prediction ({task_type}): {list(cols_to_drop)}")
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
            if 'data' in context and len(context['data']) == len(predictions):
                result_df = context['data'].copy()
            else:
                # Fallback if lengths don't match or data missing
                if isinstance(data_to_predict, pd.DataFrame):
                    result_df = data_to_predict.copy()
                else:
                    result_df = pd.DataFrame(data_to_predict)
        
        target_col = context.get('target_col', '')
        pred_col_name = f"prediction_{target_col}" if target_col else "prediction"
        
        result_df[pred_col_name] = predictions
        result_df['prediction_time'] = datetime.utcnow()
        
        if 'run_id' in context:
            result_df['run_id'] = context['run_id']
            
        result_df['model_type'] = type(model).__name__
        
        # Reorder columns to put prediction column first
        if pred_col_name in result_df.columns:
            cols = [pred_col_name] + [c for c in result_df.columns if c != pred_col_name]
            result_df = result_df[cols]
        
        context['data'] = result_df
        logger.info(f"Prediction completed. Output column: {pred_col_name}")
