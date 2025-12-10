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
            logger.info(f"Preprocessing script not found at {script_path}. Creating default template.")
            try:
                os.makedirs(os.path.dirname(script_path), exist_ok=True)
                with open(script_path, 'w') as f:
                    f.write(DEFAULT_PREPROCESS_TEMPLATE)
            except Exception as e:
                logger.error(f"Failed to create default preprocessing script: {e}")
                raise ValueError(f"Script not found and failed to create default: {e}")

        # New robust loader usage 
        DataPreprocessorClass = _load_class_robust(script_path, 'DataPreprocessor')   # NEW
        preprocessor = DataPreprocessorClass()

        if target_col:
            # Training mode preprocessing
            import inspect
            sig = inspect.signature(preprocessor.preprocess_train)
            logger.info(f"DEBUG: DataPreprocessor.preprocess_train signature: {sig}")
            
            # Ensure forecasting_horizons is a list
            if forecasting_horizons and isinstance(forecasting_horizons, str):
                 forecasting_horizons = [h.strip() for h in forecasting_horizons.split(',')]
                 logger.info(f"Converted forecasting_horizons string to list: {forecasting_horizons}")

            # Call directly. 
            try:
                ret_val = preprocessor.preprocess_train(df, target_col, forecasting_horizons=forecasting_horizons, timestamp_col=timestamp_col)
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
            
            if hasattr(X_test, 'index'):
                try:
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

