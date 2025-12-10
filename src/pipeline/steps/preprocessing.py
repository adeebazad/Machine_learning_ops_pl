from .base import PipelineStepHandler
from typing import Dict, Any
import os
import logging
import importlib
import sys
import uuid

logger = logging.getLogger(__name__)

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

    def preprocess_train(self, df: pd.DataFrame, target_col: str, forecasting_horizons: list = None, timestamp_col: str = None) -> Tuple[Any, Any, Any, Any]:
        X = df.drop(columns=[target_col])
        y = df[target_col]
        numerical_cols = X.select_dtypes(include=['number']).columns
        X_scaled = X.copy()
        X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        y_encoded = self.label_encoder.fit_transform(y)
        return train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        numerical_cols = df.select_dtypes(include=['number']).columns
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
    """Load a class from file bypassing Python cache."""
    import importlib.util
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    module_name = f"{os.path.splitext(os.path.basename(file_path))[0]}_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    if not hasattr(module, class_name):
        raise ValueError(f"Class '{class_name}' not found in {file_path}")
    return getattr(module, class_name)


class PreprocessingStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        if 'data' not in context:
            raise ValueError("No data found in context for preprocessing")

        df = context['data']
        script_path = config.get('script_path', 'src/features/preprocess.py')
        target_col = config.get('target_col')
        context['target_col'] = target_col

        forecasting_config = config.get('forecasting', {})
        forecasting_horizons = forecasting_config.get('horizons')
        timestamp_col = forecasting_config.get('timestamp_col')
        
        # Sort by timestamp if provided
        if timestamp_col and timestamp_col in df.columns:
            df = df.sort_values(timestamp_col).reset_index(drop=True)
            context['data'] = df

        # Create default script if missing
        if not os.path.exists(script_path):
            os.makedirs(os.path.dirname(script_path), exist_ok=True)
            with open(script_path, 'w') as f:
                f.write(DEFAULT_PREPROCESS_TEMPLATE)

        # Load DataPreprocessor robustly (avoiding cache)
        DataPreprocessorClass = _load_class_robust(script_path, 'DataPreprocessor')
        preprocessor = DataPreprocessorClass()

        if target_col:
            import inspect
            sig = inspect.signature(preprocessor.preprocess_train)

            # Convert string horizons to list
            if forecasting_horizons and isinstance(forecasting_horizons, str):
                forecasting_horizons = [h.strip() for h in forecasting_horizons.split(',')]

            try:
                ret_val = preprocessor.preprocess_train(
                    df, target_col,
                    forecasting_horizons=forecasting_horizons,
                    timestamp_col=timestamp_col
                )
            except TypeError as e:
                # Server file likely stale
                sig = inspect.signature(preprocessor.preprocess_train)
                error_msg = (
                    f"Deployment Mismatch Error! The 'preprocess_train' method on the server does not accept the expected arguments.\n"
                    f"Server Signature: {sig}\n"
                    f"Expected Arguments: forecasting_horizons, timestamp_col\n"
                    f"Please RE-DEPLOY or sync your server files."
                )
                logger.error(error_msg)
                raise ValueError(error_msg) from e

            # Handle 4 or 5 return values
            if len(ret_val) == 5:
                X_train, X_test, y_train, y_test, X_latest = ret_val
            else:
                X_train, X_test, y_train, y_test = ret_val
                X_latest = None

            context.update({
                'X_train': X_train,
                'X_test': X_test,
                'y_train': y_train,
                'y_test': y_test,
                'X_latest': X_latest,
                'preprocessor': preprocessor
            })
        else:
            # Inference mode
            context['original_data'] = df.copy()
            context['data'] = preprocessor.preprocess_inference(df)
