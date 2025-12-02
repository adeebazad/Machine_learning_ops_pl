import sys
import os
import mlflow
from src.models.train import train

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

def test_dynamic_loading():
    print("Starting dynamic loading test...")
    
    config_path = "config/dummy_config.yaml"
    
    try:
        # Run training
        run_id = train(config_path)
        print(f"Training completed. Run ID: {run_id}")
        
        # Verify artifact
        client = mlflow.tracking.MlflowClient(tracking_uri="http://localhost:5000")
        artifacts = client.list_artifacts(run_id, path="code")
        
        found = False
        for artifact in artifacts:
            if artifact.path == "code/dummy_preprocess.py" or artifact.path == "code/preprocess.py":
                # Note: mlflow.log_artifact(path) preserves basename, so it should be dummy_preprocess.py
                # But in train.py we logged it as artifact_path="code", so it should be code/dummy_preprocess.py
                print(f"Found artifact: {artifact.path}")
                found = True
                break
        
        if found:
            print("SUCCESS: Preprocessing script logged as artifact.")
        else:
            print("FAILURE: Preprocessing script NOT found in artifacts.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Test failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_dynamic_loading()
