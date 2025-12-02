import sys
import os

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.utils.dynamic_loader import load_class_from_file

def verify():
    file_path = "src/features/finalpreprocess.py"
    try:
        print(f"Attempting to load class from {file_path}...")
        DataPreprocessor = load_class_from_file(file_path, 'DataPreprocessor')
        print("Class loaded successfully.")
        
        preprocessor = DataPreprocessor()
        print("Instance created successfully.")
        
        import pandas as pd
        df = pd.DataFrame({'A': [1, 2], 'B': [3, 4], 'target': [0, 1]})
        print("Testing preprocess_train...")
        preprocessor.preprocess_train(df, 'target')
        print("preprocess_train successful.")
        
    except Exception as e:
        print(f"Verification failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify()
