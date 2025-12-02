import yaml
import argparse
import mlflow
import mlflow.sklearn
from sklearn.metrics import accuracy_score, classification_report, mean_squared_error, r2_score
import sys
import os

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from src.data.data_loader import DataLoader
from src.utils.logger import setup_logger
from src.models.model_factory import ModelFactory
from src.utils.dynamic_loader import load_class_from_file

logger = setup_logger(__name__)

def load_config(config_path):
    with open(config_path, 'r') as file:
        return yaml.safe_load(file)

def train(config_path):
    config = load_config(config_path)
    
    # 1. Load Data
    logger.info("Loading data...")
    db_connector = DataLoader.get_connector(config['database']['type'], config['database'])
    df = db_connector.fetch_data(f"SELECT * FROM {config['database']['training_table']}")
    db_connector.close()
    
    # 2. Preprocess
    logger.info("Preprocessing data...")
    
    target_col = None
    if 'target_col' in config.get('model', {}):
         target_col = config['model']['target_col']
         logger.info(f"Using target column from config: {target_col}")
    
    if not target_col:
        # Interactive mode
        print("\n" + "="*30)
        print("Available Columns and Data Types:")
        print(df.dtypes)
        print("="*30 + "\n")

        # Ask user for target column
        target_col = input("Please enter the target column name from the list above: ").strip()
        
        # Validate input
        while target_col not in df.columns:
            logger.warning(f"Column '{target_col}' not found in dataframe.")
            target_col = input("Invalid column. Please enter the target column name again: ").strip()

    logger.info(f"Selected target column: {target_col}")

    # Dynamic Loading of Preprocessor
    script_path = config.get('preprocessing', {}).get('script_path', 'src/features/preprocess.py')
    logger.info(f"Loading preprocessor from: {script_path}")
    
    try:
        DataPreprocessorClass = load_class_from_file(script_path, 'DataPreprocessor')
        preprocessor = DataPreprocessorClass()
    except Exception as e:
        logger.error(f"Failed to load preprocessor: {e}")
        raise

    X_train, X_test, y_train, y_test = preprocessor.preprocess_train(df, target_col)
    
    # Save preprocessors
    preprocessor.save_preprocessors('models/preprocessors')

    # 3. Train & Track with MLflow
    mlflow.set_tracking_uri(config['mlflow']['tracking_uri'])
    mlflow.set_experiment(config['mlflow']['experiment_name'])

    with mlflow.start_run():
        logger.info("Starting training...")
        
        # Log the dataset
        logger.info("Logging dataset to MLflow...")
        dataset = mlflow.data.from_pandas(df, source=config['database']['training_table'])
        mlflow.log_input(dataset, context="training")
        
        # Get Model Config
        model_config = config['model']
        task_type = model_config.get('task_type', 'classification') # Default to classification
        model_name = model_config.get('name', 'RandomForestClassifier')
        params = model_config.get('params', {})
        
        logger.info(f"Task Type: {task_type}, Model: {model_name}")
        
        # Create Model using Factory
        try:
            model = ModelFactory.get_model(task_type, model_name, params)
        except Exception as e:
            logger.error(f"Failed to create model: {e}")
            raise

        model.fit(X_train, y_train)

        # 4. Evaluate
        predictions = model.predict(X_test)
        
        if task_type.lower() == 'classification':
            accuracy = accuracy_score(y_test, predictions)
            logger.info(f"Model Accuracy: {accuracy}")
            mlflow.log_metric("accuracy", accuracy)
        else:
            mse = mean_squared_error(y_test, predictions)
            r2 = r2_score(y_test, predictions)
            logger.info(f"MSE: {mse}, R2: {r2}")
            mlflow.log_metric("mse", mse)
            mlflow.log_metric("r2", r2)

        # Log params
        mlflow.log_params(params)
        mlflow.log_param("task_type", task_type)
        mlflow.log_param("model_name", model_name)
        
        # Log model
        mlflow.sklearn.log_model(model, "model")
        
        # Log preprocessors as artifacts
        mlflow.log_artifacts('models/preprocessors', artifact_path="preprocessors")
        
        # Log the preprocessing script for reproducibility
        logger.info(f"Logging preprocessing script: {script_path}")
        mlflow.log_artifact(script_path, artifact_path="code")
        
        logger.info("Training complete and logged to MLflow.")
        # Removed emojis to prevent encoding errors on Windows
        print(f"View run {mlflow.active_run().info.run_name} at: {mlflow.get_tracking_uri()}/#/experiments/{mlflow.active_run().info.experiment_id}/runs/{mlflow.active_run().info.run_id}")
        print(f"View experiment at: {mlflow.get_tracking_uri()}/#/experiments/{mlflow.active_run().info.experiment_id}")
        
        return mlflow.active_run().info.run_id

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/config.yaml", help="Path to config file")
    parser.add_argument("--target-col", help="Target column name (optional)")
    args = parser.parse_args()
    
    train(args.config)
