from .base import PipelineStepHandler
from typing import Dict, Any
import os
import logging
import importlib
import sys
import uuid
import pandas as pd
logger = logging.getLogger(__name__)

# Default Preprocessing Script Template
DEFAULT_PREPROCESS_TEMPLATE = '''import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from typing import Tuple, Any, List
import joblib
import os

class DataPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()

    def preprocess_train(self, df: pd.DataFrame, target_col: str = None, forecasting_horizons: list = None, timestamp_col: str = None) -> Tuple[Any, Any, Any, Any]:
        """
        Preprocesses training data.
        If target_col is provided: Splits into X/y, scales features, encodes target, returns (X_train, X_test, y_train, y_test).
        If target_col is None: Returns (X_train, X_test, None, None) for unsupervised learning.
        """
        # Drops rows where target is NaN (if target exists)
        if target_col and target_col in df.columns:
            df = df.dropna(subset=[target_col])
            y = df[target_col]
            X = df.drop(columns=[target_col])
        else:
            y = None
            X = df.copy()
        
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        X_scaled = X.copy()
        if len(numerical_cols) > 0:
             # Basic handling for NaN features
             X_scaled[numerical_cols] = X_scaled[numerical_cols].fillna(0)
             X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        
        # Determine if we encode y
        if y is not None:
            if not pd.api.types.is_numeric_dtype(y):
                 y_encoded = self.label_encoder.fit_transform(y)
            else:
                 y_encoded = y
            
            return train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)
        else:
            # Unsupervised: just split X
            X_train, X_test = train_test_split(X_scaled, test_size=0.2, random_state=42)
            return X_train, X_test, None, None

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        # Simplified inference preprocessing
        numerical_cols = df.select_dtypes(include=['number']).columns
        # Handle missings
        df[numerical_cols] = df[numerical_cols].fillna(0)
        return self.scaler.transform(df[numerical_cols])

    def save_preprocessors(self, path: str):
        os.makedirs(path, exist_ok=True)
        import joblib
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.label_encoder, os.path.join(path, 'label_encoder.joblib'))

    def load_preprocessors(self, path: str):
        import joblib
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
        self.label_encoder = joblib.load(os.path.join(path, 'label_encoder.joblib'))
'''

def _load_class_robust(file_path: str, class_name: str):
    """
    Robustly loads a class from file, bypassing cache using UUIDs.
    Inlined here to ensure this logic is active even if src/utils/dynamic_loader.py is stale.
    """
    import importlib.util
    import os
    import sys
    import uuid
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Use unique module name to avoid caching issues
    module_name = f"{os.path.splitext(os.path.basename(file_path))[0]}_{uuid.uuid4().hex}"
    
    try:
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None or spec.loader is None:
             raise ImportError(f"Could not load spec for module: {module_name}")
             
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        
        if not hasattr(module, class_name):
            raise ValueError(f"Class '{class_name}' not found in {file_path}")
            
        return getattr(module, class_name)
    except Exception as e:
        raise ImportError(f"Failed to load class '{class_name}' from '{file_path}': {e}")

class PreprocessingStep(PipelineStepHandler):
    """
    Step to preprocess the data using a custom script.
    """
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        logger.info("Starting Preprocessing Step...")
        
        if 'data' not in context:
            raise ValueError("No data found in context for preprocessing")
        
        df = context['data']
        script_path = config.get('script_path', 'src/features/preprocess.py')
        
        # Sanitize script path: remove 'app/' prefix if present (common when configuring from UI)
        if script_path.startswith('app/') or script_path.startswith('app\\'):
            logger.info(f"Sanitizing script path: '{script_path}' -> '{script_path[4:]}'")
            script_path = script_path[4:]
            
        target_col = config.get('target_col', None)
        # ... (rest of config extraction)
        
        if target_col:
             context['target_col'] = target_col
        else:
             logger.info("No target_col provided. Assuming Unsupervised Learning (Clustering/Anomaly Detection).")
             
        forecasting_config = config.get('forecasting', {})
        forecasting_horizons = forecasting_config.get('horizons')
        timestamp_col = forecasting_config.get('timestamp_col')
        
        if timestamp_col:
            context['timestamp_col'] = timestamp_col
            # Force sort here to ensure consistency and correct Train/Test split
            ts_col_clean = timestamp_col.strip()
            if ts_col_clean in df.columns:
                 logger.info(f"Sorting data by timestamp column '{ts_col_clean}' (Ascending)...")
                 df = df.sort_values(by=ts_col_clean, ascending=True)
                 df = df.reset_index(drop=True) # CRITICAL: Reset index so it matches X after flattening
                 context['data'] = df
            elif timestamp_col in df.columns:
                 logger.info(f"Sorting data by timestamp column '{timestamp_col}' (Ascending)...")
                 df = df.sort_values(by=timestamp_col, ascending=True)
                 df = df.reset_index(drop=True) # CRITICAL: Reset index to align with X (which gets reset in flatten)
                 context['data'] = df
            else:
                 logger.warning(f"Timestamp column '{timestamp_col}' (or '{ts_col_clean}') NOT found in DataFrame.")
                 logger.warning(f"Available columns: {df.columns.tolist()}")
        else:
             if forecasting_horizons:
                 logger.warning("Forecasting horizons provided but NO timestamp_col. Data order depends on upstream source.")
        
        if not os.path.exists(script_path):
            logger.warning(f"CRITICAL WARNING: Preprocessing script not found at {script_path}. Creating DEFAULT template. This may not be what you want!")
            logger.info(f"Creating default template at {script_path}...")
            try:
                os.makedirs(os.path.dirname(script_path), exist_ok=True)
                with open(script_path, 'w') as f:
                    f.write(DEFAULT_PREPROCESS_TEMPLATE)
            except Exception as e:
                logger.error(f"Failed to create default preprocessing script: {e}")
                raise ValueError(f"Script not found and failed to create default: {e}")

        # Call with target_col (which might be None)
        # New robust loader usage 
        DataPreprocessorClass = _load_class_robust(script_path, 'DataPreprocessor')   # NEW
        preprocessor = DataPreprocessorClass()

        if 'data' in context:
            # Training mode preprocessing

            import inspect
            sig = inspect.signature(preprocessor.preprocess_train)
            logger.info(f"DEBUG: DataPreprocessor.preprocess_train signature: {sig}")
            
            # Ensure forecasting_horizons is a list
            if forecasting_horizons and isinstance(forecasting_horizons, str):
                 forecasting_horizons = [h.strip() for h in forecasting_horizons.split(',')]
                 logger.info(f"Converted forecasting_horizons string to list: {forecasting_horizons}")

            # Infer task_type for target encoding
            task_type_inferred = 'classification'
            if target_col and target_col in df.columns:
                if pd.api.types.is_numeric_dtype(df[target_col]):
                    task_type_inferred = 'regression'
            
            logger.info(f"Inferred task_type for preprocessing: {task_type_inferred}")

            # Call directly. 
            try:
                ret_val = preprocessor.preprocess_train(df, target_col, forecasting_horizons=forecasting_horizons, timestamp_col=timestamp_col, task_type=task_type_inferred)
            except TypeError as e:
                # If we get here, it means the method signature doesn't match the arguments we passed.
                # Since we know the code in git HAS the arguments, this means the server file is stale.
                import inspect
                sig = inspect.signature(preprocessor.preprocess_train)
                error_msg = (
                    f"Deployment Mismatch Error! The 'preprocess_train' method on the server does not accept the expected arguments.\\n"
                    f"Server Signature: {sig}\\n"
                    f"Expected Arguments: forecasting_horizons, timestamp_col\\n"
                    f"This usually means the 'src/features/preprocess.py' file on the server has not been updated with the latest changes.\\n"
                    f"Please RE-DEPLOY or sync your server files."
                )
                logger.error(error_msg)
                raise ValueError(error_msg) from e
            
            # Handle 5-value return (list or tuple)
            if len(ret_val) == 5:
                X_train, X_test, y_train, y_test, X_latest = ret_val
                logger.info("Successfully identified X_latest from preprocessing.")
            elif len(ret_val) == 4:
                X_train, X_test, y_train, y_test = ret_val
                X_latest = None
                logger.info("Preprocessing returned 4 values (Standard split).")
            else:
                raise ValueError(f"Unexpected return length from preprocess_train: {len(ret_val)}")

            context['X_train'] = X_train
            context['X_test'] = X_test
            context['y_train'] = y_train
            context['y_test'] = y_test
            context['X_latest'] = X_latest
            context['preprocessor'] = preprocessor
            
            # IMPORTANT: Save unscaled X_test for Prediction step to use when testing pipeline flow
            if hasattr(X_test, 'index') and not X_test.empty:
                try:
                    # We need the original timestamps. 
                    # If df was sorted and reset_index, and X_test has the same index, we can just grab rows from df.
                    X_test_original = df.loc[X_test.index].copy()
                    context['X_test_original'] = X_test_original
                    logger.info("Saved X_test_original for unscaled prediction output.")
                except Exception as e:
                    logger.warning(f"Could not save X_test_original: {e}")
            else:
                logger.warning("X_test is not a DataFrame or missing index. specific timestamp recovery might fail.")
            
            if forecasting_horizons:
                 context['task_type'] = 'forecasting'
                 context['forecasting_horizons'] = forecasting_horizons
                 logger.info(f"Preprocessing completed (Forecasting mode). Horizons: {forecasting_horizons}")
            else:
                 logger.info("Preprocessing completed (Train/Test split).")
        else:
            # Inference mode preprocessing
            # Save original data for prediction output
            context['original_data'] = df.copy()
            
            processed_data = preprocessor.preprocess_inference(df)
            context['data'] = processed_data
            logger.info("Preprocessing completed (Inference mode).")
            context['data'] = processed_data
            logger.info("Preprocessing completed (Inference mode).")
        
        # --- Correlation Analysis (Root Cause) ---
        if 'data' in context and hasattr(context['data'], 'columns'):
             try:
                 # Check if we have X_train or just data
                 # Prefer X_train for training correlation
                 if 'X_train' in context and hasattr(context['X_train'], 'select_dtypes'):
                     corr_df = context['X_train']
                 elif isinstance(context['data'], pd.DataFrame):
                     corr_df = context['data']
                 else:
                     corr_df = None
                 
                 if corr_df is not None:
                     numerical_feats = corr_df.select_dtypes(include=['number'])
                     if not numerical_feats.empty:
                         corr_matrix = numerical_feats.corr()
                         
                         # Save locally
                         corr_path = "correlation_matrix.csv"
                         corr_matrix.to_csv(corr_path)
                         logger.info(f"Calculated Correlation Matrix for {len(numerical_feats.columns)} features.")
                         
                         # Log to MLflow if active run exists (it might not be active in preprocessing step, 
                         # usually TrainingStep starts the run. But if we are in a pipeline, maybe we want to save it to context 
                         # and let TrainingStep log it? Or just save it to disk and TrainingStep picks it up?)
                         # Re-thinking: Preprocessing doesn't usually start an MLflow run. TrainingStep does.
                         # Better to save to context and let TrainingStep log it as artifact.
                         context['correlation_matrix_path'] = corr_path
                         logger.info("Saved correlation matrix to context.")
             except Exception as e:
                 logger.warning(f"Failed to calculate correlation matrix: {e}")
        if timestamp_col and 'data' in context:
             try:
                 # Check max timestamp in the processed data (or original df if available)
                 # df variable holds the data used.
                 if timestamp_col in df.columns:
                      max_ts = df[timestamp_col].max()
                      
                      # Determine format and current time
                      import time
                      from datetime import datetime
                      
                      current_time_ms = time.time() * 1000
                      last_data_ms = 0
                      
                      # Try parsing max_ts
                      ts_val = df[timestamp_col].dropna().iloc[-1] if not df[timestamp_col].dropna().empty else None
                      
                      if ts_val is not None:
                           is_numeric = isinstance(ts_val, (int, float))
                           if is_numeric:
                                # Assume ms if huge, seconds if small?
                                # Simple heuristic: > 3e10 usually ms (year 1980+)
                                if max_ts > 30000000000: 
                                     last_data_ms = max_ts
                                else:
                                     last_data_ms = max_ts * 1000
                           else:
                                # Datetime object
                                # Convert to timestamp
                                if hasattr(max_ts, 'timestamp'):
                                     last_data_ms = max_ts.timestamp() * 1000
                                else:
                                     # String or other? Try pandas conversion
                                     try:
                                         dt = pd.to_datetime(max_ts)
                                         last_data_ms = dt.timestamp() * 1000
                                     except:
                                         pass
                           
                           if last_data_ms > 0:
                                lag_ms = current_time_ms - last_data_ms
                                lag_hours = lag_ms / (1000 * 60 * 60)
                                
                                if lag_hours > 2:
                                     logger.warning(
                                          f"DATA LATENCY WARNING: Your latest data point is {lag_hours:.1f} hours old. "
                                          f"If your forecasting horizon is smaller than this (e.g. 1h), "
                                          f"your 'future' prediction will still be in the past! "
                                          f"Consider increasing your horizon (e.g. '1d') or checking your data ingestion."
                                     )
                                else:
                                     logger.info(f"Data is fresh ({lag_hours:.1f} hours lag).")
             except Exception as e:
                 logger.warning(f"Could not verify data freshness: {e}")
