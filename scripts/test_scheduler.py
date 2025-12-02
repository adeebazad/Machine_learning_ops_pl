import requests
import time
import datetime
import json

BASE_URL = "http://localhost:8001"

def test_scheduler():
    # 1. Calculate schedule time (1 minute from now)
    now = datetime.datetime.utcnow()
    schedule_time = (now + datetime.timedelta(minutes=1)).strftime("%H:%M")
    print(f"Current UTC time: {now.strftime('%H:%M:%S')}")
    print(f"Scheduling pipeline for: {schedule_time}")
    
    # 2. Create a scheduled pipeline
    create_payload = {
        "name": f"Scheduled Pipeline {int(time.time())}",
        "description": "Testing scheduler",
        "schedule_enabled": True,
        "schedule_time": schedule_time,
        "steps": [
            {
                "name": "Step 1",
                "step_type": "extraction",
                "order": 0,
                "config_json": {"query": "SELECT 1"}
            }
        ]
    }
    
    print("Creating pipeline...")
    response = requests.post(f"{BASE_URL}/pipelines/", json=create_payload)
    if response.status_code != 200:
        print(f"Failed to create pipeline: {response.text}")
        return
    
    pipeline_id = response.json()["id"]
    print(f"Pipeline created with ID: {pipeline_id}")
    
    # 3. Wait for execution
    print("Waiting for scheduler (approx 70 seconds)...")
    time.sleep(70)
    
    # 4. Verify run
    print("Verifying execution...")
    response = requests.get(f"{BASE_URL}/pipelines/{pipeline_id}")
    data = response.json()
    
    if data["last_run"]:
        print(f"Success! Pipeline last_run updated: {data['last_run']}")
    else:
        print("Failure: Pipeline last_run is null.")
        
    # Check runs
    response = requests.get(f"{BASE_URL}/pipelines/{pipeline_id}/runs")
    runs = response.json()
    if len(runs) > 0:
        print(f"Found {len(runs)} runs. Latest status: {runs[0]['status']}")
    else:
        print("Failure: No runs found.")

if __name__ == "__main__":
    test_scheduler()
