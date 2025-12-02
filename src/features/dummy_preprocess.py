import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os

class DataPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.encoders = {}

    def preprocess_train(self, df, target_col):
        print("DEBUG: Using DUMMY Preprocessor!")
        # Simple preprocessing for testing
        df = df.dropna()
        
        # Drop non-numeric for simplicity in this dummy version
        X = df.drop(columns=[target_col]).select_dtypes(include=['number'])
        y = df[target_col]
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        return X_train_scaled, X_test_scaled, y_train, y_test

    def preprocess_inference(self, df):
        print("DEBUG: Using DUMMY Preprocessor for Inference!")
        X = df.select_dtypes(include=['number'])
        return self.scaler.transform(X)

    def save_preprocessors(self, path):
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(path, 'scaler.joblib'))

    def load_preprocessors(self, path):
        self.scaler = joblib.load(os.path.join(path, 'scaler.joblib'))
