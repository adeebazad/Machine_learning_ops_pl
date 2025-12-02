import requests
import yaml
import json

BASE_URL = "http://127.0.0.1:8000"
CONFIG_PATH = "config/config.yaml"

def load_config():
    with open(CONFIG_PATH, 'r') as f:
        return yaml.safe_load(f)

def test_get_columns():
    config = load_config()
    table = config['database']['training_table']
    
    print(f"Testing get_columns for table: {table}")
    
    url = f"{BASE_URL}/database/columns/{table}"
    try:
        response = requests.post(url, json=config['database'])
        
        if response.status_code == 200:
            print("✅ Success!")
            print("Columns:", json.dumps(response.json(), indent=2))
        else:
            print(f"❌ Failed with {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_get_columns()
