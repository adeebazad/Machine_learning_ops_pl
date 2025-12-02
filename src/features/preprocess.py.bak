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

    def preprocess_train(self, df: pd.DataFrame, target_col: str) -> Tuple[Any, Any, Any, Any]:
        """
        Preprocesses training data: splits into X/y, scales features, encodes target.
        """
        X = df.drop(columns=[target_col])
        y = df[target_col]

        # Flatten JSON columns
        X = self._flatten_json_columns(X)
        
        # Handle categorical features if any (simple implementation for now)
        # For this example, we assume numerical features except target
        
        # Identify numerical columns for scaling
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        # Scale numerical features
        X_scaled = X.copy()
        X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        
        # Encode target
        y_encoded = self.label_encoder.fit_transform(y)

        return train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)

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
