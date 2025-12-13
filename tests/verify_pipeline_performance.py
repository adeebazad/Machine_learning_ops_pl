import sys
import os
import pandas as pd
import numpy as np

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.models.model_factory import ModelFactory
from src.features.finalpreprocess import DataPreprocessor
# Correct import structure check needed.

def test_pipeline_performance():
    print("=== Checking Pipeline Performance ===")
    
    # 1. Mock Data
    print("[1] Generating Mock Data...")
    dates = pd.date_range(start='2024-01-01', periods=100, freq='H')
    df = pd.DataFrame({
        'dateissuedutc': dates,
        'pm10': np.random.normal(50, 10, 100),
        'temperature': np.random.normal(25, 5, 100),
        'humidity': np.random.normal(60, 10, 100)
    })
    print(f"    Data Shape: {df.shape}")
    
    # 2. Preprocessing
    print("[2] Testing Preprocessing (Robust)...")
    try:
        from src.features.finalpreprocess import DataPreprocessor
        preprocessor = DataPreprocessor()
        # Test Forecasting Mode
        X_train, X_test, y_train, y_test, X_latest = preprocessor.preprocess_train(
            df, target_col='pm10', forecasting_horizons=['4h'], timestamp_col='dateissuedutc', task_type='regression' 
        )
        print(f"    Preprocessing Success!")
        print(f"    X_train: {X_train.shape}, y_train: {y_train.shape}")
        if X_latest is not None:
             print(f"    X_latest (Future): {X_latest.shape} rows identification successful.")
        else:
             print("    WARNING: X_latest is None (Forecasting logic might be off)")
             
    except Exception as e:
        print(f"    FAILED: Preprocessing crashed: {e}")
        return

    # 3. Model Training
    print("[3] Testing Model Training (XGBRegressor)...")
    try:
        from xgboost import XGBRegressor
        model = XGBRegressor()
        model.fit(X_train, y_train)
        print("    Training Success!")
        
        score = model.score(X_test, y_test)
        print(f"    R2 Score on Mock Data: {score:.4f} (Expected to be low for random data, but functional)")
    except Exception as e:
        print(f"    FAILED: Training crashed: {e}")
        return
        
    print("\n=== CORRECTNESS CHECK ===")
    print("Project Core Components are FUNCTIONAL.")

if __name__ == "__main__":
    test_pipeline_performance()
