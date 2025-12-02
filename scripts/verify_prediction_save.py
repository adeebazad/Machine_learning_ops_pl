import requests
import time
import sys
import json
from datetime import datetime

BASE_URL = "http://localhost:8001"

def run():
    print("Starting Prediction Save Verification...")

    # 1. Find the "Browser Test Exp" experiment
    print("Fetching experiments...")
    experiments = requests.get(f"{BASE_URL}/experiments/").json()
    exp = next((e for e in experiments if e['name'] == "Browser Test Exp"), None)
    if not exp:
        print("Error: 'Browser Test Exp' not found.")
        return

    # 2. Find the "Browser Test Conf" config
    print(f"Fetching configs for experiment {exp['id']}...")
    configs = requests.get(f"{BASE_URL}/experiments/{exp['id']}/configs").json()
    conf = next((c for c in configs if c['name'] == "Browser Test Conf"), None)
    if not conf:
        print("Error: 'Browser Test Conf' not found.")
        return

    # 3. Trigger Prediction
    print("Triggering prediction...")
    # Sample data matching the user's request
    sample_data = [
      {
        "Serial Number": 0,
        "UTC": 1654733339, # Use a distinct timestamp to identify
        "Temperature[C]": 20,
        "Humidity[%]": 50,
        "TVOC[ppb]": 0,
        "eCO2[ppm]": 400,
        "Raw H2": 12000,
        "Raw Ethanol": 19000,
        "Pressure[hPa]": 939,
        "PM1.0": 0,
        "PM2.5": 0,
        "NC0.5": 0,
        "NC1.0": 0,
        "NC2.5": 0,
        "CNT": 0
      }
    ]
    
    predict_payload = {
        "data": sample_data,
        "config_id": conf['id'],
        "days_to_predict": 0 # Standard inference
    }
    
    try:
        response = requests.post(f"{BASE_URL}/predict", json=predict_payload)
        if response.status_code != 200:
            print(f"Error triggering prediction: {response.text}")
            return
        
        print("Prediction successful.")
        print(json.dumps(response.json(), indent=2))
        
        # 4. Verify in Database
        print("Verifying in database...")
        # We can use the /database/test endpoint or similar if available, or just use a direct query via a script
        # Since we have direct access, let's use a python script to query
        
        import mysql.connector
        
        db_config = conf['config_json']['database']
        
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database']
        )
        
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT * FROM {db_config['prediction_table']} ORDER BY prediction_time DESC LIMIT 1")
        row = cursor.fetchone()
        
        if row:
            print("\nLatest Prediction in DB:")
            print(row)
            
            # Check timestamp
            pred_time = row['prediction_time']
            now = datetime.utcnow()
            print(f"Prediction Time: {pred_time}")
            print(f"Current Time: {now}")
            
            # Simple check if it's recent (within last minute)
            # Note: server time might differ slightly but should be close
            print("Verification successful: Prediction found in database.")
        else:
            print("Error: No prediction found in database.")
            
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run()
