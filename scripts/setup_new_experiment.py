import requests
import time
import sys

BASE_URL = "http://localhost:8001"

def wait_for_api():
    print("Waiting for API to be available...")
    for i in range(30):
        try:
            response = requests.get(f"{BASE_URL}/docs")
            if response.status_code == 200:
                print("API is available.")
                return True
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(2)
    print("API timed out.")
    return False

def create_experiment():
    print("Creating new experiment...")
    payload = {
        "name": "Fresh Start Experiment",
        "description": "Created automatically after system cleanup."
    }
    try:
        response = requests.post(f"{BASE_URL}/experiments/", json=payload)
        if response.status_code == 200:
            exp = response.json()
            print(f"Experiment created: ID={exp['id']}, Name={exp['name']}")
            return exp['id']
        else:
            print(f"Failed to create experiment: {response.text}")
            return None
    except Exception as e:
        print(f"Error creating experiment: {e}")
        return None

def create_config(experiment_id):
    print("Creating new configuration...")
    # Default config structure
    config_data = {
        "database": {
            "type": "mysql",
            "host": "localhost",
            "port": 3306,
            "database": "alter_managment",
            "user": "root",
            "password": "password", # Placeholder, user might need to update
            "training_table": "smoke_detection_iot",
            "prediction_table": "smoke_detection_pred"
        },
        "model": {
            "task_type": "classification",
            "name": "RandomForestClassifier",
            "target_col": "Fire Alarm"
        },
        "preprocessing": {
            "script_path": "src/features/preprocess.py"
        },
        "mlflow": {
            "tracking_uri": "http://localhost:5000",
            "experiment_name": "Fresh_Start_Exp"
        }
    }
    
    payload = {
        "name": "Initial Config",
        "config_json": config_data
    }
    
    try:
        response = requests.post(f"{BASE_URL}/experiments/{experiment_id}/configs", json=payload)
        if response.status_code == 200:
            conf = response.json()
            print(f"Configuration created: ID={conf['id']}, Name={conf['name']}")
            return conf['id']
        else:
            print(f"Failed to create config: {response.text}")
            return None
    except Exception as e:
        print(f"Error creating config: {e}")
        return None

if __name__ == "__main__":
    if wait_for_api():
        exp_id = create_experiment()
        if exp_id:
            create_config(exp_id)
    else:
        sys.exit(1)
