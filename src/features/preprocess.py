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
        
        print(f"DEBUG: Initial DF shape: {df.shape}")
        
        # Robustness: Drop rows where target is NaN immediately
        df = df.dropna(subset=[target_col])
        print(f"DEBUG: DF shape after dropna(target): {df.shape}")

        # Sort by timestamp if provided
        # Sort by timestamp if provided
        if timestamp_col:
            ts_col_clean = timestamp_col.strip()
            if ts_col_clean in df.columns:
                df = df.sort_values(by=ts_col_clean)
                df = df.reset_index(drop=True)
            elif timestamp_col in df.columns:
                 df = df.sort_values(by=timestamp_col)
                 df = df.reset_index(drop=True)
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
        if timestamp_col and timestamp_col.strip() in numerical_cols:
            ts_col_clean = timestamp_col.strip()
            print(f"Excluding timestamp column '{ts_col_clean}' from scaling.")
            numerical_cols = numerical_cols.drop(ts_col_clean)
        else:
            if timestamp_col:
                print(f"DEBUG: timestamp_col '{timestamp_col}' not found in numerical_cols: {numerical_cols}")
        
        # Scale numerical features
        X_scaled = X.copy()
        if len(numerical_cols) > 0:
            # Handle NaNs in numerical columns before scaling to prevent crash
            if X[numerical_cols].isnull().any().any():
                print("Warning: NaNs detected in numerical features. Filling with 0.")
                X[numerical_cols] = X[numerical_cols].fillna(0)
            
            # Fill ANY remaining NaNs in X (e.g. categorical) to prevent dropna later
            # This is critical for sparse sensor data
            if X.isnull().any().any():
                 print("Warning: NaNs detected in non-numerical features. Filling with 'Unknown' or 0.")
                 X = X.fillna('Unknown') # Default strategy

            X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
            
            # Update X_scaled with the filled categorical columns too (if any were not numeric)
            # Actually X_scaled was a copy, careful.
            # We want X_scaled to have the FILLED values.
            # Copy non-numericals back if needed? 
            # Or just operate on X_scaled?
            # Let's ensure X_scaled has no NaNs.
            non_numeric = X.columns.difference(numerical_cols)
            if len(non_numeric) > 0:
                 X_scaled[non_numeric] = X[non_numeric]

        # Store scaler for later use
        self.fitted_numerical_cols = numerical_cols
        
        # Encode target if it's not a forecasting task (classification/single regression)
        if not forecasting_horizons:
             if not pd.api.types.is_numeric_dtype(y):
                 y = self.label_encoder.fit_transform(y)
        
        combined = pd.concat([X_scaled, y], axis=1)
        
        # Identification of "Future/Latest" rows: where y has NaNs (due to shifting)
        if forecasting_horizons:
            target_cols_list = y.columns.tolist()
            mask_future = y[target_cols_list].isnull().any(axis=1)
            
            X_latest = combined.loc[mask_future, X_scaled.columns]
            
            print(f"Identified {len(X_latest)} rows for future forecasting (latest data).")
            
            # DIAGNOSTICS
            print(f"DEBUG: Combined shape before dropna: {combined.shape}")
            print(f"DEBUG: NaNs per column:\n{combined.isnull().sum()}")
            
            # CRITICAL FIX: Only drop rows where TARGETS are missing.
            # Keep rows where features might be sparse (we already filled them above, but just in case)
            combined_clean = combined.dropna(subset=target_cols_list)
            
            if combined_clean.empty:
                raise ValueError(
                    f"Insufficient data for forecasting! "
                    f"After shifting for horizons {forecasting_horizons}, no rows remained directly for training. "
                    f"This usually means your dataset is shorter than the requested horizon (e.g. asking for 1d shift on <1d data) "
                    f"or contains too many gaps. Please reduce the horizon to '1h' or check data continuity."
                )
        else:
             combined_clean = combined.dropna()
             X_latest = pd.DataFrame(columns=X_scaled.columns)

        X_final = combined_clean[X_scaled.columns]
        y_final = combined_clean[y.columns if isinstance(y, pd.DataFrame) else y.name]

        return train_test_split(X_final, y_final, test_size=0.2, shuffle=False if (timestamp_col or forecasting_horizons) else True, random_state=42 if not (timestamp_col or forecasting_horizons) else None) + [X_latest]

    def _create_forecasting_targets(self, df: pd.DataFrame, target_col: str, horizons: list, timestamp_col: str = None) -> Tuple[pd.DataFrame, list]:
        """
        Generates shifted target columns based on horizons.
        Dynamically calculates 'steps' based on data frequency if timestamp_col is provided.
        """
        df = df.copy()
        new_target_cols = []
        
        # Calculate Data Frequency
        ms_per_row = None
        if timestamp_col and timestamp_col in df.columns:
            try:
                # Assuming timestamp is numeric or convertible to datetime
                # If numeric (epoch ms), diff gives ms.
                # If datetime, diff gives timedelta (convert to total_seconds * 1000)
                
                # Sort first just in case
                # (Data should be sorted by caller, but safe check)
                
                # Calculate median diff of first 1000 rows to estimate freq
                # Convert to numeric if needed
                ts_series = df[timestamp_col]
                if pd.api.types.is_datetime64_any_dtype(ts_series):
                    diffs = ts_series.diff().dt.total_seconds() * 1000
                else:
                    diffs = ts_series.diff() # Assume numeric ms
                
                median_diff = diffs.median()
                
                if median_diff > 0:
                    ms_per_row = median_diff
                    print(f"Detected data frequency: {ms_per_row} ms/row (approx {ms_per_row/1000/60:.1f} mins)")
            except Exception as e:
                print(f"Warning: Could not detect frequency from timestamp_col: {e}")

        for h in horizons:
            steps = 0
            name = f"target_+{h}"
            
            # Parse Horizon Duration in MS
            horizon_ms = 0
            if isinstance(h, str):
                h_clean = h.lower()
                if h_clean.endswith('h'):
                    horizon_ms = int(h_clean[:-1]) * 60 * 60 * 1000
                elif h_clean.endswith('d'):
                    horizon_ms = int(h_clean[:-1]) * 24 * 60 * 60 * 1000
            
            # Calculate Steps
            if ms_per_row and horizon_ms > 0:
                steps = int(horizon_ms / ms_per_row)
                print(f"Horizon '{h}' ({horizon_ms} ms) requires {steps} steps based on frequency.")
            else:
                # Fallback to hardcoded assumptions
                if isinstance(h, int):
                    steps = h
                elif isinstance(h, str):
                    if h.endswith('h'):
                        steps = int(h[:-1]) # Fallback: 1h = 1 row (DANGEROUS if not hourly)
                    elif h.endswith('d'):
                        steps = int(h[:-1]) * 24 # Fallback: 1d = 24 rows
                    else:
                        try:
                            steps = int(h)
                        except:
                            print(f"Warning: Could not parse horizon '{h}'. skipping.")
                            continue
            
            # Safety for Step Size
            if steps <= 0:
                steps = 1 # Minimum 1 step if valid horizon
                
            if steps >= len(df):
                print(f"WARNING: accurate shift for '{h}' requires {steps} steps, but only {len(df)} rows available. This will drop ALL data.")
            
            if steps > 0:
                print(f"Creating target '{name}' with shift -{steps} for DataFrame of shape {df.shape}")
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
