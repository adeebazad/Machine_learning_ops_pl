import requests
import time
import json

BASE_URL = "http://localhost:8001"

def run():
    print("Starting Pipeline Verification...")

    # 1. Create Pipeline
    print("Creating Pipeline...")
    pipeline_data = {
        "name": "Test Pipeline " + str(int(time.time())),
        "description": "Automated test pipeline",
        "steps": [
            {
                "name": "Extraction",
                "step_type": "extraction",
                "order": 0,
                "config_json": {
                    "database": {
                        "type": "mysql",
                        "host": "localhost",
                        "port": 3306,
                        "user": "root",
                        "password": "root",
                        "database": "alter_managment"
                    },
                    "query": "SELECT * FROM smoke_detection_iot LIMIT 100"
                }
            },
            {
                "name": "Preprocessing",
                "step_type": "preprocessing",
                "order": 1,
                "config_json": {
                    "script_path": "src/features/preprocess.py",
                    "target_col": "Fire Alarm"
                }
            },
            {
                "name": "Training",
                "step_type": "training",
                "order": 2,
                "config_json": {
                    "mlflow": {
                        "tracking_uri": "http://localhost:5000",
                        "experiment_name": "Pipeline_Test_Exp"
                    },
                    "model": {
                        "name": "RandomForestClassifier",
                        "task_type": "classification",
                        "params": {"n_estimators": 10}
                    }
                }
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/pipelines/", json=pipeline_data)
    if response.status_code != 200:
        print(f"Error creating pipeline: {response.text}")
        return
    
    pipeline = response.json()
    print(f"Pipeline created. ID: {pipeline['id']}")
    
    # 2. Trigger Run
    print("Triggering Pipeline Run...")
    response = requests.post(f"{BASE_URL}/pipelines/{pipeline['id']}/run")
    if response.status_code != 200:
        print(f"Error triggering run: {response.text}")
        return
    
    run_data = response.json()
    run_id = run_data['run_id']
    print(f"Run started. ID: {run_id}")
    
    # 3. Wait for completion
    print("Waiting for completion...")
    for i in range(60):
        runs = requests.get(f"{BASE_URL}/pipelines/{pipeline['id']}/runs").json()
        current_run = next((r for r in runs if r['id'] == run_id), None)
        
        if current_run:
            print(f"Status: {current_run['status']}")
            if current_run['status'] == 'completed':
                print("Pipeline completed successfully!")
                print("Logs:")
                print(current_run['logs'])
                return
            elif current_run['status'] == 'failed':
                print("Pipeline failed!")
                print("Logs:")
                print(current_run['logs'])
                return
        
        time.sleep(2)
        
    print("Timeout waiting for pipeline.")

if __name__ == "__main__":
    run()
