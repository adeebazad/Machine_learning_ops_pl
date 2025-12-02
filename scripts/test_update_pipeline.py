import requests
import json

BASE_URL = "http://localhost:8001"

def test_update_pipeline():
    # 1. Create a pipeline
    create_payload = {
        "name": "Update Test Pipeline",
        "description": "Initial description",
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
    
    # 2. Update the pipeline
    update_payload = {
        "name": "Updated Pipeline Name",
        "description": "Updated description",
        "steps": [
            {
                "name": "Step 1 Updated",
                "step_type": "extraction",
                "order": 0,
                "config_json": {"query": "SELECT 2"}
            },
            {
                "name": "Step 2 New",
                "step_type": "preprocessing",
                "order": 1,
                "config_json": {"script_path": "src/features/preprocess.py"}
            }
        ]
    }
    
    print("Updating pipeline...")
    response = requests.put(f"{BASE_URL}/pipelines/{pipeline_id}", json=update_payload)
    if response.status_code != 200:
        print(f"Failed to update pipeline: {response.text}")
        return
        
    print("Pipeline updated successfully.")
    
    # 3. Verify update
    print("Verifying update...")
    response = requests.get(f"{BASE_URL}/pipelines/{pipeline_id}")
    data = response.json()
    
    if data["name"] != "Updated Pipeline Name":
        print(f"Name mismatch: {data['name']}")
    elif len(data["steps"]) != 2:
        print(f"Step count mismatch: {len(data['steps'])}")
    else:
        print("Verification successful! Pipeline name and steps updated.")

if __name__ == "__main__":
    test_update_pipeline()
