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
        
        # Auto-create script if it doesn't exist
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
        
        forecasting_config = config.get('forecasting', {})
        forecasting_horizons = forecasting_config.get('horizons')
        timestamp_col = forecasting_config.get('timestamp_col')

        if target_col:
            # Training mode preprocessing
            # Check if preprocess_train accepts forecasting arguments (to maintain backward compatibility if user hasn't updated script)
            # Actually, I updated the script, so it should be fine. But if it's a user-supplied script without the args, it might fail.
            # However, the task is to enable this feature. I assume the script is the one I just edited.
            
            import inspect
            sig = inspect.signature(preprocessor.preprocess_train)
            if 'forecasting_horizons' in sig.parameters:
                 X_train, X_test, y_train, y_test = preprocessor.preprocess_train(df, target_col, forecasting_horizons=forecasting_horizons, timestamp_col=timestamp_col)
            else:
                 logger.warning("DataPreprocessor.preprocess_train does not accept forecasting_horizons. Ignoring forecasting config.")
                 X_train, X_test, y_train, y_test = preprocessor.preprocess_train(df, target_col)

            context['X_train'] = X_train
            context['X_test'] = X_test
            context['y_train'] = y_train
            context['y_test'] = y_test
            context['preprocessor'] = preprocessor
            
            if forecasting_horizons:
                 context['task_type'] = 'forecasting'
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
