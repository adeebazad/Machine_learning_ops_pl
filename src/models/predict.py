import yaml
import argparse
import mlflow.sklearn
import pandas as pd
import sys
import os
import joblib

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from src.data.data_loader import DataLoader
from src.features.preprocess import DataPreprocessor
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def load_config(config_path):
    with open(config_path, 'r') as file:
        return yaml.safe_load(file)

def predict(config_path, model_uri=None):
    config = load_config(config_path)
    
    # Set MLflow tracking URI
    import mlflow
    mlflow.set_tracking_uri(config['mlflow']['tracking_uri'])
    
    # 1. Load Data for Inference (simulating reading from a 'new_data' table or similar)
    # For this example, we'll read from the training table but pretend it's new data without target
    logger.info("Loading inference data...")
    db_connector = DataLoader.get_connector(config['database']['type'], config['database'])
    # In real scenario, this would be a different table or query
    df = db_connector.fetch_data(f"SELECT * FROM {config['database']['training_table']} LIMIT 10")
    
    # Drop target if present
    target_col = df.columns[-1] # Assumption
    if target_col in df.columns:
        df_features = df.drop(columns=[target_col])
    else:
        df_features = df

    # 2. Preprocess
    logger.info("Preprocessing data...")
    preprocessor = DataPreprocessor()
    # Load preprocessors from local path (or could download from MLflow)
    # For simplicity, assuming they are available locally from training step
    if os.path.exists('models/preprocessors'):
        preprocessor.load_preprocessors('models/preprocessors')
    X_new = preprocessor.preprocess_inference(df_features)

    # 3. Load Model
    logger.info(f"Loading model from {model_uri}...")
    try:
        model = mlflow.sklearn.load_model(model_uri)
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        print("\n" + "!"*50)
        print("ERROR: Could not load the model.")
        
        if "Connection refused" in str(e) or "Max retries exceeded" in str(e):
            print("❌ CONNECTION ERROR: Unable to connect to MLflow server.")
            print("👉 Please ensure the MLflow server is running.")
            print("   Run: .\\scripts\\start_mlflow.bat")
        else:
            print("❌ ARTIFACT ERROR: The Run ID might be invalid or from an old session.")
            print("👉 Please use the Run ID from the LATEST training session.")
            
        print("!"*50 + "\n")
        sys.exit(1)

    # 4. Predict
    predictions = model.predict(X_new)
    
    # 5. Save Predictions
    df_features['prediction'] = predictions
    from datetime import datetime
    df_features['prediction_time'] = datetime.now()
    
    logger.info("Saving predictions...")
    db_connector.save_data(df_features, config['database']['prediction_table'])
    db_connector.close()
    logger.info("Inference complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/config.yaml", help="Path to config file")
    parser.add_argument("--model-uri", required=True, help="MLflow Model URI (e.g., runs:/<run_id>/model)")
    args = parser.parse_args()
    
    predict(args.config, args.model_uri)
