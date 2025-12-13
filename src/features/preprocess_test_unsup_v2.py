import pandas as pd
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
