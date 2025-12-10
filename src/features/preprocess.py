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
            # Drop original target col from X if we are forecasting future, usually we want past values in X.
            # But here X is everything except the *new* targets? 
            # Standard approach: X includes features at time t. y is value at t+k.
            # So we drop the *future* target columns from X.
            # We also typically drop the original target_col from X unless it's a feature (lagged).
            # For simplicity, let's strictly split: X = all cols except user-defined target_col and generated targets.
            # y = generated targets.
            
            # Update y to be the new targets
            y = df[target_cols]
            X = df.drop(columns=target_cols + [target_col]) # Drop original target from X too to avoid leakage if it's the same variable
        else:
            X = df.drop(columns=[target_col])
            y = df[target_col]

        # Flatten JSON columns
        X = self._flatten_json_columns(X)
        
        # Identify numerical columns for scaling
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        # Exclude timestamp_col from scaling if present
        if timestamp_col and timestamp_col in numerical_cols:
            print(f"Excluding timestamp column '{timestamp_col}' from scaling.")
            numerical_cols = numerical_cols.drop(timestamp_col)
        
        # Scale numerical features
        X_scaled = X.copy()
        if len(numerical_cols) > 0:
            X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        
        # Encode target if it's not a forecasting task (classification/single regression)
        # If forecasting, we usually keep y as numeric (regression)
        if not forecasting_horizons:
             # Check if y is numeric. If so, don't encode.
             if not pd.api.types.is_numeric_dtype(y):
                 y = self.label_encoder.fit_transform(y)
        
        # Drop NaNs created by shifting
        # We need to align X and y
        # X and y indices should match
        
        combined = pd.concat([X_scaled, y], axis=1).dropna()
        X_final = combined[X_scaled.columns]
        y_final = combined[y.columns if isinstance(y, pd.DataFrame) else y.name]

        return train_test_split(X_final, y_final, test_size=0.2, shuffle=False if (timestamp_col or forecasting_horizons) else True, random_state=42 if not (timestamp_col or forecasting_horizons) else None)

    def _create_forecasting_targets(self, df: pd.DataFrame, target_col: str, horizons: list) -> Tuple[pd.DataFrame, list]:
        """
        Generates shifted target columns based on horizons.
        Horizons can be '1h', '6h', '1d' or integers '1', '6'.
        Assumes data is regularly spaced if using time suffix, or just treats as row steps.
        Current implementation: treats '1h' as 1 step, '6h' as 6 steps if hourly is assumed, 
        BUT to be safe and simple: checks if suffix exists.
        If suffix 'h', 'd' exists -> creates shifts assuming specific step sizes relative to row frequency.
        Simplification: Just interpret '1h' -> 1 step, '6h' -> 6 steps? No, that's dangerous.
        Let's assume the user knows the data frequency. 
        Better: Use pd.to_timedelta if index is datetime.
        
        Strategy:
        1. Parse horizon. If it looks like 'Xh', extract X.
        2. If integer, use as period.
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
                    steps = int(h[:-1]) # Assumption: 1 row = 1 hour. If data is 15min, this is wrong.
                    # TODO: Infer frequency from timestamp_col if available.
                elif h.endswith('d'):
                    steps = int(h[:-1]) * 24 # Assumption: Hourly data
                else:
                    try:
                        steps = int(h)
                    except:
                        # Fallback for '1d', etc if logic above failed or other unit
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
            # Check if column is object type and might contain JSON
            if df[col].dtype == 'object':
                try:
                    # Try parsing the first non-null value to see if it's JSON
                    print(f"Checking column: {col}")
                    first_val = df[col].dropna().iloc[0]
                    if isinstance(first_val, str) and (first_val.strip().startswith('{') or first_val.strip().startswith('[')):
                        print(f"Detected JSON in column: {col}. Flattening...")
                        # It looks like JSON, let's try to flatten
                        # Parse all values
                        parsed = df[col].apply(lambda x: json.loads(x) if isinstance(x, str) else x)
                        
                        # Normalize (flatten)
                        flattened = pd.json_normalize(parsed)
                        
                        # Rename columns to avoid collisions
                        flattened.columns = [f"{col}_{c}" for c in flattened.columns]
                        
                        # Concatenate and drop original
                        # Reset index to match
                        df = df.reset_index(drop=True)
                        flattened.index = df.index
                        df = pd.concat([df, flattened], axis=1).drop(columns=[col])
                        print(f"Flattened JSON column: {col}")
                except Exception as e:
                    # Not JSON or failed to parse, skip
                    print(f"Skipping column {col}: {e}")
                    pass
        print("JSON flattening complete.")
        return df

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        """
        Preprocesses inference data using fitted scaler.
        """
        # Ensure columns match training (simplified)
        df = self._flatten_json_columns(df)
        
        # Select only numerical columns that were fitted
        # In a real scenario, we need to handle missing columns or extra columns
        # For now, we assume the scaler knows the feature names (if using sklearn > 1.0)
        # or we just select numericals.
        numerical_cols = df.select_dtypes(include=['number']).columns
        
        # Align with scaler's expected features (this is tricky without saving feature names)
        # For this demo, we assume the input df has the same structure after flattening
        
        return self.scaler.transform(df[numerical_cols])

    def save_preprocessors(self, path: str):
        """
        Saves scaler and label encoder to disk.
        """
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.label_encoder, os.path.join(path, 'label_encoder.joblib'))

    def load_preprocessors(self, path: str):
        """
        Loads scaler and label encoder from disk.
        """
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
        self.label_encoder = joblib.load(os.path.join(path, 'label_encoder.joblib'))
