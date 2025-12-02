import requests
import time
import json

API_URL = "http://localhost:8001"

def test_db_migration():
    print("Starting DB Migration Verification...")
    
    # 1. Create Experiment
    print("\n1. Creating Experiment...")
    exp_data = {
        "name": f"Test Experiment {int(time.time())}",
        "description": "Automated test experiment"
    }
    res = requests.post(f"{API_URL}/experiments/", json=exp_data)
    if res.status_code != 200:
        print(f"FAILED to create experiment: {res.text}")
        return
    experiment = res.json()
    print(f"SUCCESS: Created Experiment ID {experiment['id']}")
    
    # 2. Create Config
    print("\n2. Creating Configuration...")
    config_data = {
        "name": "Test Config",
        "config_json": {
            "database": {
                "type": "mysql",
                "host": "localhost",
                "port": 3306,
                "user": "root",
                "password": "root",
                "database": "alter_managment",
                "training_table": "smoke_detection_iot",
                "prediction_table": "orders_pred"
            },
            "model": {
                "task_type": "classification",
                "name": "RandomForestClassifier",
                "target_col": "Fire Alarm"
            },
            "mlflow": {
                "tracking_uri": "http://localhost:5000",
                "experiment_name": "Test Experiment DB"
            },
            "preprocessing": {
                "script_path": "src/features/preprocess.py"
            }
        }
    }
    res = requests.post(f"{API_URL}/experiments/{experiment['id']}/configs", json=config_data)
    if res.status_code != 200:
        print(f"FAILED to create config: {res.text}")
        return
    config = res.json()
    print(f"SUCCESS: Created Config ID {config['id']}")
    
    # 3. Trigger Training
    print("\n3. Triggering Training...")
    train_req = {"config_id": config['id']}
    res = requests.post(f"{API_URL}/train", json=train_req)
    if res.status_code != 200:
        print(f"FAILED to trigger training: {res.text}")
        return
    print(f"SUCCESS: Training triggered. Response: {res.json()}")
    
    # 4. Verify Job Status (Wait for completion)
    print("\n4. Verifying Job Status...")
    for i in range(10):
        time.sleep(2)
        res = requests.get(f"{API_URL}/experiments/{experiment['id']}/jobs")
        jobs = res.json()
        if not jobs:
            print("No jobs found yet...")
            continue
            
        job = jobs[-1] # Get latest
        print(f"Job Status: {job['status']}")
        
        if job['status'] == 'completed':
            print(f"SUCCESS: Job completed with MLflow Run ID: {job['mlflow_run_id']}")
            return
        elif job['status'] == 'failed':
            print("FAILED: Job failed.")
            return
            
    print("TIMEOUT: Job did not complete in time.")

if __name__ == "__main__":
    try:
        test_db_migration()
    except Exception as e:
        print(f"ERROR: {e}")
