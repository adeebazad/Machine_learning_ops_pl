import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from typing import Tuple, Any
import joblib
import os

class DataPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.target_scaler = StandardScaler() # Separate scaler for target in regression

    def preprocess_train(self, df: pd.DataFrame, target_col: str = None, forecasting_horizons: list = None, timestamp_col: str = None, task_type: str = 'classification') -> Tuple[Any, Any, Any, Any]:
        """
        Preprocesses training data: splits into X/y, scales features, encodes target.
        """
        # Handle optional target (Unsupervised support)
        if target_col and target_col in df.columns:
            # Drop target, scale numerics, encode target
            X = df.drop(columns=[target_col])
            y = df[target_col]
        else:
            X = df.copy()
            y = None
        
        # Select numerical columns
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        # Scale
        X_scaled = X.copy()
        if len(numerical_cols) > 0:
            X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        
        # Encode target if present
        if y is not None:
            # Determine how to encode based on task_type or dtype
            # We need task_type passed in config ideally. 
            # If not passed, we guess.
            
            is_regression = task_type in ['regression', 'time_series']
            
            if is_regression:
                 # Reshape for scaler
                 y_reshaped = y.values.reshape(-1, 1)
                 y_encoded = self.target_scaler.fit_transform(y_reshaped).ravel()
            else:
                 # Classification
                 y_encoded = self.label_encoder.fit_transform(y)
                 
            return train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)
        else:
            # Unsupervised split
            X_train, X_test = train_test_split(X_scaled, test_size=0.2, random_state=42)
            return X_train, X_test, None, None

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        """
        Preprocesses inference data using fitted scaler.
        """
        numerical_cols = df.select_dtypes(include=['number']).columns
        return self.scaler.transform(df[numerical_cols])

    def save_preprocessors(self, path: str):
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.label_encoder, os.path.join(path, 'label_encoder.joblib'))
        joblib.dump(self.target_scaler, os.path.join(path, 'target_scaler.joblib'))

    def load_preprocessors(self, path: str):
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
        try:
            self.label_encoder = joblib.load(os.path.join(path, 'label_encoder.joblib'))
        except: pass
        try:
             self.target_scaler = joblib.load(os.path.join(path, 'target_scaler.joblib'))
        except: pass
