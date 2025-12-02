import requests
import sys

BASE_URL = "http://localhost:8001"

def update_config():
    print("Updating config credentials...")
    try:
        # Get existing config
        # Assuming Exp 1, Config 1 as per setup
        config_id = 1
        res = requests.get(f"{BASE_URL}/experiments/configs/{config_id}")
        if res.status_code != 200:
            print(f"Config not found: {res.text}")
            return
            
        config = res.json()
        config_json = config['config_json']
        
        # Update password
        config_json['database']['password'] = "root"
        
        # Update via PUT
        payload = {
            "name": config['name'],
            "config_json": config_json
        }
        
        update_res = requests.put(f"{BASE_URL}/experiments/configs/{config_id}", json=payload)
        if update_res.status_code == 200:
            print("Config updated successfully.")
        else:
            print(f"Failed to update config: {update_res.text}")
            
    except Exception as e:
        print(f"Error updating config: {e}")

if __name__ == "__main__":
    update_config()
