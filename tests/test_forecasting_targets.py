import pandas as pd
import numpy as np
import pytest
from src.features.preprocess import DataPreprocessor

def test_forecasting_targets():
    # Setup data
    # Create 48 hours of data
    dates = pd.date_range(start='2024-01-01', periods=48, freq='h')
    df = pd.DataFrame({
        'timestamp': dates,
        'value': range(48),
        'feature': np.random.randn(48)
    })
    
    target_col = 'value'
    horizons = ['1h', '6h', '1d']
    
    preprocessor = DataPreprocessor()
    
    # Run preprocessing
    # Note: Our implementation assumes 'd' = 24h if suffix is d.
    # '1h' -> shift -1
    # '6h' -> shift -6
    # '1d' -> shift -24
    
    X_train, X_test, y_train, y_test = preprocessor.preprocess_train(
        df, 
        target_col=target_col, 
        forecasting_horizons=horizons, 
        timestamp_col='timestamp'
    )
    
    # Reassemble to check logic (ignoring the split for a moment, or checking X_train/y_train alignment)
    print("X_train shape:", X_train.shape)
    print("y_train shape:", y_train.shape)
    print("y_train columns:", y_train.columns)
    
    # Check if columns exist
    assert 'target_+1h' in y_train.columns
    assert 'target_+6h' in y_train.columns
    assert 'target_+1d' in y_train.columns
    
    # Check logic
    # The max shift is 24 (1d). So we lose 24 rows from the end.
    # Total rows = 48. Expected remaining = 24.
    # But train_test_split splits this result (80/20).
    # Total samples before split = 48 - 24 = 24.
    # X_train size approx 19, X_test approx 5.
    
    n_samples = len(X_train) + len(X_test)
    assert n_samples == 48 - 24
    
    # Check value alignment on the first sample (index 0)
    # y_train['target_+1h'].iloc[0] should be value at index 1 -> 1
    # y_train['target_+6h'].iloc[0] should be value at index 6 -> 6
    # y_train['target_+1d'].iloc[0] should be value at index 24 -> 24
    
    # Since we shuffle=False for forecasting, index order should be preserved relative to start
    # X_train is the first split.
    
    val_1h = y_train['target_+1h'].iloc[0]
    expected_1h = 1 # 'value' column is range(48)
    
    val_6h = y_train['target_+6h'].iloc[0]
    expected_6h = 6
    
    val_1d = y_train['target_+1d'].iloc[0]
    expected_1d = 24
    
    print(f"1h target: {val_1h}, expected: {expected_1h}")
    print(f"6h target: {val_6h}, expected: {expected_6h}")
    print(f"1d target: {val_1d}, expected: {expected_1d}")
    
    assert val_1h == expected_1h
    assert val_6h == expected_6h
    assert val_1d == expected_1d

if __name__ == "__main__":
    test_forecasting_targets()
    print("Test Passed!")
