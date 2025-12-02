import requests
import time

BASE_URL = "http://localhost:8001"

def reproduce_delete_error():
    # 1. Create a pipeline
    create_payload = {
        "name": f"Delete Test Pipeline {int(time.time())}",
        "description": "Testing deletion",
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
    
    # 2. Run the pipeline to create a run record
    print("Running pipeline...")
    response = requests.post(f"{BASE_URL}/pipelines/{pipeline_id}/run")
    if response.status_code != 200:
        print(f"Failed to run pipeline: {response.text}")
        return
    print("Pipeline run started.")
    
    # 3. Try to delete the pipeline
    print("Attempting to delete pipeline...")
    response = requests.delete(f"{BASE_URL}/pipelines/{pipeline_id}")
    
    if response.status_code == 200:
        print("Pipeline deleted successfully (Unexpected if bug exists).")
    else:
        print(f"Failed to delete pipeline: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    reproduce_delete_error()
