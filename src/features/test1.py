import pandas as pd
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
        """
        Preprocesses training data: splits into X/y, scales features, encodes target.
        Supports forecasting horizons (e.g., ['1h', '6h']) by creating shifted targets.
        """
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found in DataFrame. Available: {df.columns.tolist()}")

        # Sort by timestamp if provided
        if timestamp_col:
            if timestamp_col in df.columns:
                df = df.sort_values(by=timestamp_col)
            else:
                print(f"Warning: timestamp_col '{timestamp_col}' not found. assuming data is already sorted.")

        # Handle Forecasting Targets
        if forecasting_horizons:
            print(f"Generating forecasting targets for horizons: {forecasting_horizons}")
            df, target_cols = self._create_forecasting_targets(df, target_col, forecasting_horizons)
            # Update y to be the new targets
            y = df[target_cols]
            X = df.drop(columns=target_cols + [target_col]) # Drop original target from X too
        else:
            X = df.drop(columns=[target_col])
            y = df[target_col]

        # Flatten JSON columns
        X = self._flatten_json_columns(X)
        
        # Identify numerical columns for scaling
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        # Exclude timestamp_col from scaling if present
        if timestamp_col and timestamp_col.strip() in numerical_cols:
            ts_col_clean = timestamp_col.strip()
            print(f"Excluding timestamp column '{ts_col_clean}' from scaling.")
            numerical_cols = numerical_cols.drop(ts_col_clean)
        else:
             if timestamp_col:
                print(f"DEBUG: timestamp_col '{timestamp_col}' not found in numerical_cols or not provided.")
        
        # Scale numerical features
        X_scaled = X.copy()
        if len(numerical_cols) > 0:
            X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
            
        self.fitted_numerical_cols = numerical_cols
        
        # Encode target if it's not a forecasting task (classification/single regression)
        # If forecasting, we usually keep y as numeric (regression)
        if not forecasting_horizons:
             # Check if y is numeric. If so, don't encode.
             if not pd.api.types.is_numeric_dtype(y):
                 y = self.label_encoder.fit_transform(y)
        
        # Drop NaNs created by shifting
        combined = pd.concat([X_scaled, y], axis=1).dropna()
        X_final = combined[X_scaled.columns]
        y_final = combined[y.columns if isinstance(y, pd.DataFrame) else y.name]

        return train_test_split(X_final, y_final, test_size=0.2, shuffle=False if (timestamp_col or forecasting_horizons) else True, random_state=42 if not (timestamp_col or forecasting_horizons) else None)

    def _create_forecasting_targets(self, df: pd.DataFrame, target_col: str, horizons: list) -> Tuple[pd.DataFrame, list]:
        """
        Generates shifted target columns based on horizons.
        """
        df = df.copy()
        new_target_cols = []
        
        for h in horizons:
            steps = 0
            name = f"target_+{h}"
            
            # Simple parsing logic
            if isinstance(h, int):
                steps = h
            elif isinstance(h, str):
                if h.endswith('h'):
                    steps = int(h[:-1]) # Assumption: 1 row = 1 hour.
                elif h.endswith('d'):
                    steps = int(h[:-1]) * 24 # Assumption: Hourly data
                else:
                    try:
                        steps = int(h)
                    except:
                        print(f"Warning: Could not parse horizon '{h}'. skipping.")
                        continue
            
            if steps > 0:
                print(f"Creating target '{name}' with shift -{steps}")
                df[name] = df[target_col].shift(-steps)
                new_target_cols.append(name)
        
        return df, new_target_cols

    def _flatten_json_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Detects and flattens columns containing JSON strings.
        """
        import json
        print("Starting JSON flattening...")
        
        df = df.copy()
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    first_val = df[col].dropna().iloc[0]
                    if isinstance(first_val, str) and (first_val.strip().startswith('{') or first_val.strip().startswith('[')):
                        print(f"Detected JSON in column: {col}. Flattening...")
                        parsed = df[col].apply(lambda x: json.loads(x) if isinstance(x, str) else x)
                        flattened = pd.json_normalize(parsed)
                        flattened.columns = [f"{col}_{c}" for c in flattened.columns]
                        df = df.reset_index(drop=True)
                        flattened.index = df.index
                        df = pd.concat([df, flattened], axis=1).drop(columns=[col])
                        print(f"Flattened JSON column: {col}")
                except Exception as e:
                    pass
        print("JSON flattening complete.")
        return df

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        # Simplified inference preprocessing
        df = self._flatten_json_columns(df)
        numerical_cols = df.select_dtypes(include=['number']).columns
        # Note: This might fail if columns don't match exactly.
        # In production, we should align columns with training features.
        return self.scaler.transform(df[numerical_cols])

    def save_preprocessors(self, path: str):
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.label_encoder, os.path.join(path, 'label_encoder.joblib'))

    def load_preprocessors(self, path: str):
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
        self.label_encoder = joblib.load(os.path.join(path, 'label_encoder.joblib'))
