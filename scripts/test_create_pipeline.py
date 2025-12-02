import requests
import json

API_URL = "http://localhost:8001/pipelines/"

def test_create_pipeline():
    payload = {
        "name": "Debug Pipeline " + str(import_time()),
        "description": "Debugging creation failure",
        "steps": [
            {
                "name": "Extraction",
                "step_type": "extraction",
                "order": 0,
                "config_json": {"query": "SELECT * FROM smoke_detection_iot LIMIT 10", "database": {"type": "mysql"}}
            }
        ]
    }
    
    try:
        print(f"Sending POST request to {API_URL}...")
        response = requests.post(API_URL, json=payload)
        
        print(f"Status Code: {response.status_code}")
        try:
            print("Response:", response.json())
        except:
            print("Response Text:", response.text)
            
    except Exception as e:
        print(f"Request failed: {e}")

def import_time():
    import time
    return int(time.time())

if __name__ == "__main__":
    test_create_pipeline()
