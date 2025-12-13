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
        # But for the OUTPUT DataFrame, we prefer the unscaled original version 'X_test_original' if saved.
        
        if 'X_test' in context:
             data_to_predict = context['X_test']
             used_test_set = True
             logger.info("Using X_test from training for prediction.")
             
             # If we have the unscaled version, we want to use THAT for the result_df, 
             # but we must use the scaled 'data_to_predict' for the model input.
             if 'X_test_original' in context:
                 logger.info("Found X_test_original. Will use it for output DataFrame to preserve timestamps.")
                 pass
             
             # If we have X_latest (future rows), we want to PREDICT on them too.
             # So data_to_predict should be X_test + X_latest
             if 'X_latest' in context and context['X_latest'] is not None and not context['X_latest'].empty:
                  logger.info(f"Found X_latest ({len(context['X_latest'])} rows) for explicit future forecasting.")
                  
                  # Concatenate features for input
                  # X_test is scaled. X_latest is scaled.
                  if isinstance(data_to_predict, pd.DataFrame) and isinstance(context['X_latest'], pd.DataFrame):
                       # Align columns just in case
                       X_latest_aligned = context['X_latest'][data_to_predict.columns]
                       data_to_predict = pd.concat([data_to_predict, X_latest_aligned], axis=0)
                       logger.info(f"Combined X_test and X_latest. Total rows: {len(data_to_predict)}")
                       
                       # Also need to handle X_test_original for output
                       if 'X_test_original' in context:
                            # We need the unscaled version of X_latest to join here?
                            # X_latest coming from preprocessing is SCALED X.
                            # We need original X_latest.
                            # Preprocessing step didn't save unscaled X_latest explicitly?
                            # Actually X_latest was derived from combined scaled X.
                            # To get unscaled X_latest, we might need to inverse transform it?
                            # Or better: Preprocessing step should return unscaled X_latest?
                            # For now, let's use the scaled X_latest tokens for the output, OR
                            # Since we have timestamp_col in context, maybe we can reconstruct?
                            # Actually, if we use X_test_original + X_latest (scaled), the timestamps in X_latest might be scaled/missing?
                            # X_latest has index. If index is preserved from original df, we can fetch from original df?
                            # But original df is not saved in Training mode (unless we change that).
                            
                            # Workaround: Just append X_latest to result_df. timestamps will be missing/scaled if unscaled_X_latest not available.
                            # BUT wait, the timestamp_col is EXCLUDED from scaling if config matches.
                            # So X_latest should have unscaled timestamp_col!
                            pass 
                  else:
                       logger.warning("X_latest or X_test format mismatch. Skipping combination.") 
        elif 'data' in context:
             # Inference mode
             data_to_predict = context['data']
             logger.info("Using context['data'] for prediction.")
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
        
        
        # INVERSE TRANSFORM PREDICTIONS (for Regression/Time Series)
        # Check if we have a target scaler in the preprocessor
        if 'preprocessor' in context:
             prep = context['preprocessor']
             if hasattr(prep, 'target_scaler') and prep.target_scaler is not None:
                 # Only inverse transform if we are not doing Classification (or check model type?)
                 # Actually, target_scaler is only populated for Regression in our new logic.
                 # So if it exists, use it?
                 # Double check if classification label encoder is also there?
                 # DataPreprocessor has attributes initialized to default. Check if 'mean_' attribute exists on scaler to see if fitted.
                 
                 is_scaler_fitted = hasattr(prep.target_scaler, 'mean_') or hasattr(prep.target_scaler, 'center_') # StandardScaler/MinMaxScaler
                 
                 # CRITICAL FIX: Do NOT inverse transform for Classification or Anomaly Detection tasks!
                 # Even if a scaler exists (e.g. from a previous run or misconfiguration), we shouldn't scale labels (0,1 or -1,1)
                 task_type_check = context.get('task_type', 'unknown')
                 model_type_check = type(model).__name__
                 
                 skip_inverse = (
                     task_type_check in ['classification', 'anomaly_detection', 'clustering'] or
                     'Classifier' in model_type_check or
                     'IsolationForest' in model_type_check or
                     'OneClassSVM' in model_type_check or
                     'LocalOutlierFactor' in model_type_check
                 )

                 if is_scaler_fitted and not skip_inverse:
                     logger.info("Target Scaler found and fitted. Inverse transforming predictions...")
                     try:
                         # Predictions shape
                         if predictions.ndim == 1:
                             predictions = prep.target_scaler.inverse_transform(predictions.reshape(-1, 1)).ravel()
                         else:
                             predictions = prep.target_scaler.inverse_transform(predictions)
                     except Exception as e:
                         logger.warning(f"Failed to inverse transform predictions: {e}")

        # Attach predictions to data
        result_df = None
        
        if used_test_set:
            # If we used X_test, it's already a DataFrame (likely scaled)
            if 'X_test_original' in context:
                result_df = context['X_test_original'].copy()
                
                # Check if we combined X_latest into data_to_predict
                # If so, result_df needs to include X_latest too
                if len(data_to_predict) > len(result_df):
                     # We have extra rows (X_latest).
                     # We need to append them.
                     # X_latest is in context['X_latest'] (scaled).
                     # Ideally we want unscaled. But since timestamp wasn't scaled, we can use it.
                     if 'X_latest' in context and context['X_latest'] is not None:
                          X_latest = context['X_latest']
                          # Reconcile columns
                          # X_test_original has all cols (or most). X_latest has feature cols.
                          # We align to X_test_original columns if possible.
                          try:
                               # Identify common columns
                               common_cols = result_df.columns.intersection(X_latest.columns)
                               X_latest_subset = X_latest[common_cols]
                               result_df = pd.concat([result_df, X_latest_subset], axis=0) 
                          except Exception as e:
                               logger.warning(f"Failed to append X_latest to result_df: {e}")
            elif isinstance(data_to_predict, pd.DataFrame):
                result_df = data_to_predict.copy()
            else:
                result_df = pd.DataFrame(data_to_predict)
        else:
            # Inference mode
            # If we have original unscaled data (saved by preprocessing step), use it.
            if 'original_data' in context:
                logger.info("Using original_data for output (preserving timestamps/metadata).")
                result_df = context['original_data'].copy()
                # Ensure length matches
                if len(result_df) != len(predictions):
                     logger.warning(f"Length mismatch between original_data ({len(result_df)}) and predictions ({len(predictions)}). Fallback to data_to_predict.")
                     if isinstance(data_to_predict, pd.DataFrame):
                        result_df = data_to_predict.copy()
                     else:
                        result_df = pd.DataFrame(data_to_predict)
            
            # If we used inference mode, we want to attach predictions to the ORIGINAL data
            # context['data'] holds the original data before preprocessing (for this step)
            elif 'data' in context and len(context['data']) == len(predictions):
                result_df = context['data'].copy()
            else:
                # Fallback if lengths don't match or data missing
                if isinstance(data_to_predict, pd.DataFrame):
                    result_df = data_to_predict.copy()
                else:
                    result_df = pd.DataFrame(data_to_predict)
        
        if 'run_id' in context:
            result_df['run_id'] = context['run_id']
            
        result_df['model_type'] = type(model).__name__
        
        # Handle predictions (could be 1D or 2D)
        # Check shape of predictions
        import numpy as np
        
        if isinstance(predictions, np.ndarray) and predictions.ndim > 1 and predictions.shape[1] > 1:
            # Multi-output prediction
            logger.info(f"Multi-output predictions detected: shape {predictions.shape}")
            # Try to infer column names from model if possible, or use generic
            target_names = None
            
            # If we just trained, context['y_train'] might have columns
            if 'y_train' in context and isinstance(context['y_train'], pd.DataFrame):
                 target_names = context['y_train'].columns.tolist()
                 # Ensure length matches
                 if len(target_names) != predictions.shape[1]:
                     logger.warning("y_train columns count does not match prediction columns count. using generic names.")
                     target_names = [f"prediction_{i}" for i in range(predictions.shape[1])]
            else:
                 target_names = [f"prediction_{i}" for i in range(predictions.shape[1])]
            
            # Assign columns
            for i, name in enumerate(target_names):
                col_name = f"prediction_{name}" if not name.startswith("prediction") else name
                result_df[col_name] = predictions[:, i]
                
            # Reorder: put prediction columns first
            pred_cols = [f"prediction_{name}" if not name.startswith("prediction") else name for name in target_names]
            other_cols = [c for c in result_df.columns if c not in pred_cols]
            result_df = result_df[pred_cols + other_cols]
            
            logger.info(f"Attached multi-output predictions: {pred_cols}")
            
            # --- Forecasting Future Timestamp Logic ---
            # Try to calculate future timestamps if we are in forecasting mode
            timestamp_col = context.get('timestamp_col')
            if timestamp_col and timestamp_col in result_df.columns:
                 # Check if we have prediction columns with horizons
                 import re
                 
                 for col in pred_cols:
                      # Expected format: prediction_target_+1h or prediction_target_+6h
                      # Regex specific to our naming convention
                      match = re.search(r'prediction_target_\+(\d+[hd])', col)
                      if match:
                           horizon_str = match.group(1)
                           try:
                               delta = None
                               if horizon_str.endswith('h'):
                                    hours = int(horizon_str[:-1])
                                    delta = pd.Timedelta(hours=hours)
                                    # Handle milliseconds if timestamp is int
                                    # If timestamp is int/long (millis), adding Timedelta won't work directly.
                                    # Need check type of timestamp_col
                                    
                               elif horizon_str.endswith('d'):
                                    days = int(horizon_str[:-1])
                                    delta = pd.Timedelta(days=days)
                               
                               if delta:
                                   future_ts_col = f"timestamp_+{horizon_str}"
                                   
                                   # Check dtype of timestamp_col
                                   ts_series = result_df[timestamp_col]
                                   if pd.api.types.is_numeric_dtype(ts_series):
                                       # Assume milliseconds if large values (> 1e10). 
                                       # If it was safe to assume millis:
                                       # 1 hour = 3600 * 1000 ms
                                       ms_delta = delta.total_seconds() * 1000
                                       result_df[future_ts_col] = ts_series + ms_delta
                                   else:
                                       # Assume datetime object
                                       result_df[future_ts_col] = pd.to_datetime(ts_series) + delta
                                       
                                   logger.info(f"Created future timestamp column '{future_ts_col}' from '{timestamp_col}' + {horizon_str}")
                           except Exception as e:
                               logger.warning(f"Failed to calculate future timestamp for {col}: {e}")
            # ------------------------------------------
            
        else:
            # Single output
            target_col = context.get('target_col', '')
            pred_col_name = f"prediction_{target_col}" if target_col else "prediction"
            
            result_df[pred_col_name] = predictions
            
            # Reorder columns to put prediction column first
            if pred_col_name in result_df.columns:
                cols = [pred_col_name] + [c for c in result_df.columns if c != pred_col_name]
                result_df = result_df[cols]
                
            logger.info(f"Prediction completed. Output column: {pred_col_name}")
        
        context['data'] = result_df
        logger.info(f"Prediction completed. Output column(s) attached.")
        
        # --- Forecasting Future Timestamp Logic ---
        # Robust Logic: Check context for horizons, or infer from columns
        timestamp_col = context.get('timestamp_col')
        forecasting_horizons = context.get('forecasting_horizons')
        
        # If horizons not in context, try to infer from single 1h config? 
        # But prediction step config doesn't have it usually. rely on context or column names.
        
        if timestamp_col and timestamp_col in result_df.columns:
             import re
             
             # Determine which columns are predictions and what their horizons are.
             # List of tuples: (prediction_column_name, horizon_str)
             horizons_to_process = []
             
             if forecasting_horizons:
                  # We have explicit horizons from preprocessing
                  # We need to map them to columns.
                  # If multi-output, we generated specific names.
                  # If single output (len(forecasting_horizons)==1), it's the single pred column
                  if len(forecasting_horizons) == 1:
                       # Single output case
                       # Find the prediction column.
                       # It's usually 'prediction_{target_col}' or just 'prediction'
                       target_col = context.get('target_col', '')
                       pred_col = f"prediction_{target_col}" if target_col else "prediction"
                       # Check if this column exists
                       if pred_col in result_df.columns:
                            horizons_to_process.append((pred_col, forecasting_horizons[0]))
                       elif f"prediction_{forecasting_horizons[0]}" in result_df.columns:
                            # Maybe it was named with horizon
                            horizons_to_process.append((f"prediction_{forecasting_horizons[0]}", forecasting_horizons[0]))
                  else:
                       # Multi output
                       for h in forecasting_horizons:
                            # Try to find corresponding column
                            # Logic used in prediction.py naming: 'prediction_target_+1h' usually
                            # But if names were inferred generic 'prediction_0', this breaks.
                            # Let's try standard names.
                            possible_names = [f"prediction_target_+{h}", f"prediction_{h}", f"prediction_target_{h}"]
                            for name in possible_names:
                                 if name in result_df.columns:
                                      horizons_to_process.append((name, h))
                                      break
             else:
                  # Fallback to Regex on columns if context missing
                  for col in result_df.columns:
                      if col.startswith("prediction"):
                           match = re.search(r'prediction_target_\+(\d+[hd])', col)
                           if match:
                                horizons_to_process.append((col, match.group(1)))
            
             # Process timestamps
             
             # Process timestamps and MELT into new rows for the chart
             future_rows_list = []
             
             for pred_col, horizon_str in horizons_to_process:
                   try:
                       delta = None
                       h_str = str(horizon_str).lower().strip()
                       
                       if h_str.endswith('h'):
                            hours = int(h_str[:-1])
                            delta = pd.Timedelta(hours=hours)
                       elif h_str.endswith('d'):
                            days = int(h_str[:-1])
                            delta = pd.Timedelta(days=days)
                       elif h_str.isdigit():
                            delta = pd.Timedelta(hours=int(h_str))
                       
                       if delta:
                           # Create a copy of the dataframe for this horizon
                           horizon_df = result_df.copy()
                           
                           # Update timestamp column
                           ts_series = horizon_df[timestamp_col]
                           if pd.api.types.is_numeric_dtype(ts_series):
                               ms_delta = delta.total_seconds() * 1000
                               horizon_df[timestamp_col] = ts_series + ms_delta
                           else:
                               horizon_df[timestamp_col] = pd.to_datetime(ts_series) + delta
                           
                           # FIX: Also update 'dateissuedutc' if it exists, as UI prefers this for plotting
                           if 'dateissuedutc' in horizon_df.columns and timestamp_col != 'dateissuedutc':
                               d_series = horizon_df['dateissuedutc']
                               if pd.api.types.is_numeric_dtype(d_series):
                                   horizon_df['dateissuedutc'] = d_series + ms_delta
                               else:
                                   horizon_df['dateissuedutc'] = pd.to_datetime(d_series) + delta
                           
                           # Update prediction column: The 'prediction' column should take values from the horizon-specific prediction
                           # The original 'prediction' column has t+0.
                           # We want this row to have prediction = value of pred_col (e.g., prediction_+4d)
                           if pred_col in horizon_df.columns:
                                # Primary prediction column for this row becomes the forecast value
                                # Assuming standard 'prediction' column is what UI plots
                                # We need to overwrite 'prediction' variable or column if it exists?
                                # Ideally, we want one 'prediction' column for the chart line.
                                # If there is a 'prediction' column (t+0), we overwrite it with 'prediction_+4d'
                                main_pred_col = f"prediction_{context.get('target_col', '')}" if context.get('target_col') else "prediction"
                                if main_pred_col in horizon_df.columns:
                                     horizon_df[main_pred_col] = horizon_df[pred_col]
                                else:
                                     horizon_df['prediction'] = horizon_df[pred_col]

                           # Set Actuals to NaN to distinguish Forecast from History in Chart
                           target_col_name = context.get('target_col')
                           if target_col_name and target_col_name in horizon_df.columns:
                                horizon_df[target_col_name] = None # NaN
                           
                           # Add metadata
                           horizon_df['is_forecast'] = True
                           horizon_df['forecast_horizon'] = horizon_str
                           
                           future_rows_list.append(horizon_df)
                           
                           logger.info(f"Created {len(horizon_df)} future rows for horizon '{horizon_str}'")
                   except Exception as e:
                       logger.warning(f"Failed to calculate future rows for horizon {horizon_str}: {e}")
            
             if future_rows_list:
                  future_df = pd.concat(future_rows_list, ignore_index=True)
                  result_df = pd.concat([result_df, future_df], ignore_index=True)
                  logger.info(f"Appended {len(future_df)} total future rows to output.")

             # Update context data with new columns/rows
             context['data'] = result_df
        # ------------------------------------------
        
        # UX Improvement: Sort Result Descending by Timestamp
        # The user wants to see the LATEST predictions first.
        # Priority: explicit 'dateissuedutc' (from user data) > configured 'timestamp_col'
        sort_col = None
        if 'dateissuedutc' in result_df.columns:
            sort_col = 'dateissuedutc'
        elif timestamp_col and timestamp_col in result_df.columns:
            sort_col = timestamp_col
            
        if sort_col:
             try:
                 logger.info(f"Sorting output dataframe by '{sort_col}' descending (Newest First).")
                 result_df = result_df.sort_values(by=sort_col, ascending=False)
                 context['data'] = result_df
             except Exception as e:
                 logger.warning(f"Failed to sort output by timestamp: {e}")

