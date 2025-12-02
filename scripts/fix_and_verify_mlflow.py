import requests
import time
import sys
import json

BASE_URL = "http://localhost:8001"

def run():
    print("Starting MLflow fix verification...")

    # 1. Find the "Browser Test Exp" experiment
    print("Fetching experiments...")
    experiments = requests.get(f"{BASE_URL}/experiments/").json()
    exp = next((e for e in experiments if e['name'] == "Browser Test Exp"), None)
    if not exp:
        print("Error: 'Browser Test Exp' not found.")
        return

    print(f"Found Experiment: {exp['name']} (ID: {exp['id']})")

    # 2. Find the "Browser Test Conf" config
    print(f"Fetching configs for experiment {exp['id']}...")
    configs = requests.get(f"{BASE_URL}/experiments/{exp['id']}/configs").json()
    conf = next((c for c in configs if c['name'] == "Browser Test Conf"), None)
    if not conf:
        print("Error: 'Browser Test Conf' not found.")
        return

    print(f"Found Config: {conf['name']} (ID: {conf['id']})")

    # 3. Update the config with correct MLflow experiment name
    print("Updating config with MLflow experiment name 'Browser_Test_Exp'...")
    current_json = conf['config_json']
    
    # Ensure mlflow section exists
    if 'mlflow' not in current_json:
        current_json['mlflow'] = {}
    
    current_json['mlflow']['experiment_name'] = "Browser_Test_Exp"
    current_json['mlflow']['tracking_uri'] = "http://localhost:5000"

    # Send update
    update_payload = {
        "name": conf['name'],
        "config_json": current_json
    }
    response = requests.put(f"{BASE_URL}/experiments/configs/{conf['id']}", json=update_payload)
    if response.status_code != 200:
        print(f"Error updating config: {response.text}")
        return
    
    print("Config updated successfully.")

    # 4. Trigger Training
    print("Triggering training...")
    train_payload = {
        "experiment_id": exp['id'],
        "config_id": conf['id']
    }
    response = requests.post(f"{BASE_URL}/train", json=train_payload)
    if response.status_code != 200:
        print(f"Error triggering training: {response.text}")
        return
    
    job_data = response.json()
    job_id = job_data['job_id']
    print(f"Training started. Job ID: {job_id}")

    # 5. Wait for completion
    print("Waiting for training to complete...")
    for i in range(120):
        try:
            jobs = requests.get(f"{BASE_URL}/experiments/{exp['id']}/jobs").json()
            job = next((j for j in jobs if j['id'] == job_id), None)
            
            if job:
                print(f"Job Status: {job['status']}")
                if job['status'] == 'completed':
                    print("Training completed successfully.")
                    print(f"MLflow Run ID: {job.get('mlflow_run_id')}")
                    return
                elif job['status'] == 'failed':
                    print("Training failed.")
                    return
            else:
                print("Job not found yet...")
            
            time.sleep(2)
        except Exception as e:
            print(f"Error checking status: {e}")
            time.sleep(2)

    print("Training timed out.")

if __name__ == "__main__":
    run()
