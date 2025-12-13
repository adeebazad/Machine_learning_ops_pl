import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from typing import Tuple, Any, List
import joblib
import os
import json

class DataPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.target_scaler = StandardScaler() # Separate scaler for target in regression
        self.fitted_numerical_cols = None

    def preprocess_train(self, df: pd.DataFrame, target_col: str, forecasting_horizons: list = None, timestamp_col: str = None, task_type: str = 'classification') -> Tuple[Any, Any, Any, Any, Any]:
        """
        Preprocesses training data: splits into X/y, scales features, encodes target.
        Supports forecasting horizons (e.g., ['1h', '6h']) by creating shifted targets.
        """
        if target_col not in df.columns:
            # If target missing, maybe Unsupervised? But this method expects target_col.
            # If explicit None passed, we handle it, but here we expect 'target_col' string.
            print(f"Warning: Target column '{target_col}' not found. Available: {df.columns.tolist()}")
            if not target_col:
                 print("No target column provided. Assuming Unsupervised.")
            else:
                 raise ValueError(f"Target column '{target_col}' not found.")
        
        print(f"DEBUG: Initial DF shape: {df.shape}")
        
        # Robustness: Drop rows where target is NaN (only if not forecasting, or base target)
        if target_col and target_col in df.columns:
             df = df.dropna(subset=[target_col])
        print(f"DEBUG: DF shape after dropna(target): {df.shape}")

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
                print(f"Warning: timestamp_col '{timestamp_col}' not found. Assuming data is already sorted.")

        # Handle Forecasting Targets
        if forecasting_horizons:
            print(f"Generating forecasting targets for horizons: {forecasting_horizons}")
            df, target_cols = self._create_forecasting_targets(df, target_col, forecasting_horizons, timestamp_col)
            
            # X = all cols except generated targets (and original target often dropped or kept as feature)
            # Typically for forecasting, current value of target IS a feature for future.
            # So we KEEP original target in X, but DROP the FUTURE targets from X.
            
            y = df[target_cols]
            X = df.drop(columns=target_cols) 
            
            # Note: We do NOT drop target_col from X here, because past 'aqi' helps predict future 'aqi'.
            # UNLESS it causes leakage (t predicting t). 
            # But here y is t+k. X is t. So t is a valid feature.
            # However, if target_col is in X, it will be scaled.
        else:
            if target_col:
                X = df.drop(columns=[target_col])
                y = df[target_col]
            else:
                X = df.copy()
                y = None

        # Flatten JSON columns
        X = self._flatten_json_columns(X)
        
        # Identify numerical columns for scaling
        numerical_cols = X.select_dtypes(include=['number']).columns
        
        # Exclude timestamp_col from scaling if present
        if timestamp_col and timestamp_col.strip() in numerical_cols:
            ts_col_clean = timestamp_col.strip()
            # print(f"Excluding timestamp column '{ts_col_clean}' from scaling.")
            numerical_cols = numerical_cols.drop(ts_col_clean)
        
        # Scale numerical features
        X_scaled = X.copy()
        if len(numerical_cols) > 0:
            # Handle NaNs in numerical columns
            if X[numerical_cols].isnull().any().any():
                X[numerical_cols] = X[numerical_cols].fillna(0)
            
            # Fill other NaNs
            if X.isnull().any().any():
                 X = X.fillna('Unknown')

            X_scaled[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
            
            # Copy non-numericals back if needed (should be in X_scaled already since we copied X)
            # Actually X_scaled copy includes non-numeric, scaler only touches numeric. Correct.

        # Store scaler cols
        self.fitted_numerical_cols = numerical_cols
        
        # Encode target / Scale Target
        if y is not None:
             if forecasting_horizons or task_type in ['regression', 'time_series']:
                 # Regression / Time Series: Use StandardScaler for Target
                 # If multi-output (forecasting), need to handle carefully. 
                 # StandardScaler supports multi-output.
                 print(f"Scaling target ({task_type})...")
                 
                 # Handle NaNs in y before scaling?
                 # Forecasting logic below handles 'Future' rows where y is NaN.
                 # We should only fit on rows where y is NOT NaN.
                 
                 # But we haven't split Future rows yet.
                 # Let's identify Future rows first?
                 pass 
             else:
                 # Classification
                 if not pd.api.types.is_numeric_dtype(y):
                     y = self.label_encoder.fit_transform(y)

        combined = pd.concat([X_scaled, y], axis=1)
        
        # Identification of "Future/Latest" rows: where y has NaNs (due to shifting)
        X_latest = None
        if forecasting_horizons:
            target_cols_list = y.columns.tolist()
            mask_future = y[target_cols_list].isnull().any(axis=1)
            
            X_latest = combined.loc[mask_future, X_scaled.columns]
            print(f"Identified {len(X_latest)} rows for future forecasting (latest data).")
            
            # Drop rows where TARGETS are missing for training
            combined_clean = combined.dropna(subset=target_cols_list)
            
            if combined_clean.empty:
                raise ValueError("Insufficient data for forecasting! All rows dropped.")
        else:
             combined_clean = combined.dropna()
             # If target was None (Unsupervised), we don't dropna on y
             if y is None:
                 combined_clean = combined

        X_final = combined_clean[X_scaled.columns]
        
        if y is not None:
            y_final = combined_clean[y.columns if isinstance(y, pd.DataFrame) else y.name]
            
            # Now Fit Target Scaler on CLEAN y
            if forecasting_horizons or task_type in ['regression', 'time_series']:
                 # Reshape if single series
                 if isinstance(y_final, pd.Series):
                      y_reshaped = y_final.values.reshape(-1, 1)
                      y_final_scaled = self.target_scaler.fit_transform(y_reshaped).ravel()
                      y_final = pd.Series(y_final_scaled, index=y_final.index, name=y_final.name)
                 else:
                      # DataFrame
                      y_final_scaled = self.target_scaler.fit_transform(y_final)
                      y_final = pd.DataFrame(y_final_scaled, index=y_final.index, columns=y_final.columns)
        else:
            y_final = None

        return train_test_split(X_final, y_final, test_size=0.2, shuffle=False if (timestamp_col or forecasting_horizons) else True, random_state=42 if not (timestamp_col or forecasting_horizons) else None) + ([X_latest] if True else [])

    def _create_forecasting_targets(self, df: pd.DataFrame, target_col: str, horizons: list, timestamp_col: str = None) -> Tuple[pd.DataFrame, list]:
        """
        Generates shifted target columns based on horizons.
        """
        df = df.copy()
        new_target_cols = []
        
        # Calculate Data Frequency
        ms_per_row = None
        if timestamp_col and timestamp_col in df.columns:
            try:
                ts_series = df[timestamp_col]
                if pd.api.types.is_datetime64_any_dtype(ts_series):
                    diffs = ts_series.diff().dt.total_seconds() * 1000
                else:
                    diffs = ts_series.diff()
                
                median_diff = diffs.median()
                if median_diff > 0:
                    ms_per_row = median_diff
            except: pass

        for h in horizons:
            steps = 0
            name = f"target_+{h}"
            
            # Parse Horizon
            horizon_ms = 0
            if isinstance(h, str):
                h_clean = h.lower()
                if h_clean.endswith('h'):
                    horizon_ms = int(h_clean[:-1]) * 3600 * 1000
                elif h_clean.endswith('d'):
                    horizon_ms = int(h_clean[:-1]) * 86400 * 1000
            
            # Calculate Steps
            if ms_per_row and horizon_ms > 0:
                steps = int(horizon_ms / ms_per_row)
            else:
                # Fallback
                if isinstance(h, str):
                     if h.endswith('h'): steps = int(h[:-1])
                     elif h.endswith('d'): steps = int(h[:-1]) * 24 # Assume hourly data if unknown?
                elif isinstance(h, int): steps = h

            if steps <= 0: steps = 1

            if steps > 0:
                print(f"Creating target '{name}' with shift -{steps}")
                df[name] = df[target_col].shift(-steps)
                new_target_cols.append(name)
        
        return df, new_target_cols

    def _flatten_json_columns(self, df: pd.DataFrame) -> pd.DataFrame:
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
                except: pass
        return df

    def preprocess_inference(self, df: pd.DataFrame) -> Any:
        df = self._flatten_json_columns(df)
        numerical_cols = df.select_dtypes(include=['number']).columns
        # In robust version, we should align cols with fitted_numerical_cols if available
        # But handling that robustly requires saving schema. 
        # For now, simplistic approach:
        return self.scaler.transform(df[numerical_cols])

    def save_preprocessors(self, path: str):
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))
        joblib.dump(self.label_encoder, os.path.join(path, 'label_encoder.joblib'))
        joblib.dump(self.target_scaler, os.path.join(path, 'target_scaler.joblib')) # Save Target Scaler

    def load_preprocessors(self, path: str):
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
        try: self.label_encoder = joblib.load(os.path.join(path, 'label_encoder.joblib'))
        except: pass
        try: self.target_scaler = joblib.load(os.path.join(path, 'target_scaler.joblib'))
        except: pass
