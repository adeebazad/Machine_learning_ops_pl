import pandas as pd
import numpy as np
import os
import sys
import unittest
import logging

# Configure logging to see output
logging.basicConfig(level=logging.INFO)

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.pipeline.steps.preprocessing import PreprocessingStep
from src.features.test1 import DataPreprocessor

class TestForecastingPipeline(unittest.TestCase):
    def setUp(self):
        # Create dummy data
        dates = pd.date_range(start='2025-01-01', periods=10, freq='1h')
        self.df = pd.DataFrame({
            'TimeInstantIST': dates,
            'feature1': np.random.rand(10),
            'aqi': np.random.rand(10)
        })
        
        # Config
        self.config = {
            'script_path': 'src/features/test1.py',
            'target_col': 'aqi',
            'forecasting': {
                'horizons': ['1h'],
                'timestamp_col': 'TimeInstantIST'
            }
        }
        
        self.context = {'data': self.df.copy()}

    def test_pipeline_flow(self):
        print("\nRunning Preprocessing...")
        prep_step = PreprocessingStep()
        prep_step.execute(self.context, self.config)
        print("Preprocessing Done.")

if __name__ == '__main__':
    unittest.main()
