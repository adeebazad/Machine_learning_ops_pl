from .base import PipelineStepHandler
from typing import Dict, Any
import os
import logging
from src.utils.dynamic_loader import load_class_from_file

logger = logging.getLogger(__name__)

# Default Preprocessing Script Template
DEFAULT_PREPROCESS_TEMPLATE = '''import pandas as pd
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
'''

class PreprocessingStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        if 'data' not in context:
            raise ValueError("No data found in context for preprocessing")
        
        df = context['data']
        script_path = config.get('script_path', 'src/features/preprocess.py')
        target_col = config.get('target_col')
        print(f"DEBUG: target_col in PreprocessingStep: {target_col}") # Temporary debug
        if target_col:
            context['target_col'] = target_col
            
        forecasting_config = config.get('forecasting', {})
        forecasting_horizons = forecasting_config.get('horizons')
        timestamp_col = forecasting_config.get('timestamp_col')
        
        if timestamp_col:
            context['timestamp_col'] = timestamp_col
            # Force sort here to ensure consistency and correct Train/Test split
            # The SQL query might return Newest->Oldest (DESC), but we need Oldest->Newest for sequential split.
            # If sorting fails, we might end up training on Newest and Testing on Oldest (which is wrong).
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
                 # Proceeding might be dangerous if order is wrong.
        else:
             if forecasting_horizons:
                 logger.warning("Forecasting horizons provided but NO timestamp_col. Data order depends on upstream source.")
        if not os.path.exists(script_path):
            logger.info(f"Preprocessing script not found at {script_path}. Creating default template.")
            try:
                os.makedirs(os.path.dirname(script_path), exist_ok=True)
                with open(script_path, 'w') as f:
                    f.write(DEFAULT_PREPROCESS_TEMPLATE)
            except Exception as e:
                logger.error(f"Failed to create default preprocessing script: {e}")
                raise ValueError(f"Script not found and failed to create default: {e}")

        DataPreprocessorClass = load_class_from_file(script_path, 'DataPreprocessor')
        preprocessor = DataPreprocessorClass()
        
        # forecasting_config already fetched above


        if target_col:
            # Training mode preprocessing
            # Check if preprocess_train accepts forecasting arguments (to maintain backward compatibility if user hasn't updated script)
            # Actually, I updated the script, so it should be fine. But if it's a user-supplied script without the args, it might fail.
            # However, the task is to enable this feature. I assume the script is the one I just edited.
            
            # Attempt to call with forecasting arguments
            # We use try/except instead of inspect to be more robust against caching/reloading issues
            try:
                 import inspect
                 sig = inspect.signature(preprocessor.preprocess_train)
                 logger.info(f"DEBUG: DataPreprocessor.preprocess_train signature: {sig}")
                 
                 ret_val = preprocessor.preprocess_train(df, target_col, forecasting_horizons=forecasting_horizons, timestamp_col=timestamp_col)
                 
                 # Handle 5-value return (list or tuple)
                 # train_test_split returns a list.
                 if len(ret_val) == 5:
                     X_train, X_test, y_train, y_test, X_latest = ret_val
                     logger.info("Successfully identified X_latest from preprocessing.")
                 elif len(ret_val) == 4:
                     X_train, X_test, y_train, y_test = ret_val
                     X_latest = None
                     logger.info("Preprocessing returned 4 values (Standard split).")
                 else:
                     raise ValueError(f"Unexpected return length from preprocess_train: {len(ret_val)}")
                     
            except TypeError as e:
                 # Fallback: Method doesn't accept the new arguments
                 logger.error(f"DataPreprocessor.preprocess_train FAILED with forecasting args. Exception: {e}")
                 import traceback
                 logger.error(traceback.format_exc())
                 logger.warning("Forecasting configuration (horizons/timestamp) will be IGNORED in split logic (Shuffle may occur!).")
                 X_train, X_test, y_train, y_test = preprocessor.preprocess_train(df, target_col)
                 X_latest = None

            context['X_train'] = X_train
            context['X_test'] = X_test
            context['y_train'] = y_train
            context['y_test'] = y_test
            context['X_latest'] = X_latest
            context['preprocessor'] = preprocessor
            
            # IMPORTANT: Save unscaled X_test for Prediction step to use when testing pipeline flow
            # Since train_test_split is deterministic with same seed (42 or None) if we repeat it:
            # But wait, 'preprocess_train' did the split. We don't have the indices.
            # However, we can try to replicate the split on the original DF if forecasting horizons/timestamp logic matches.
            # BETTER APPROACH: Modify 'preprocess_train' to return unscaled versions? No, breaks API.
            # ALTERNATIVE: Use the fact that X_test index is preserved in pandas train_test_split.
            
            if hasattr(X_test, 'index'):
                # Reconstruct X_test_original from df using indices
                # Note: 'df' might have been modified (sorted) inside preprocess_train if timestamp_col was passed.
                # So we need the sorted df? 
                # Actually, preprocess_train sorts it internally.
                # If we want to be safe, we should assume the indices in X_test match the original df indices (if unique).
                try:
                    X_test_original = df.loc[X_test.index].copy()
                    # If target cols were dropped, they might be in df. But we want X features mainly.
                    # We can just keep all cols from df corresponding to these rows.
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
