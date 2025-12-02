import requests
import time
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(method, endpoint, data=None, description=""):
    print(f"Testing {description} ({method} {endpoint})...", end=" ")
    start_time = time.time()
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}")
        elif method == "POST":
            response = requests.post(f"{BASE_URL}{endpoint}", json=data)
        
        duration = (time.time() - start_time) * 1000
        
        if response.status_code in [200, 201]:
            print(f"✅ OK ({duration:.2f}ms)")
            return True, duration
        else:
            print(f"❌ FAILED ({response.status_code})")
            print(f"   Response: {response.text}")
            return False, duration
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False, 0

def run_verification():
    print("="*50)
    print("Starting System Verification")
    print("="*50)
    
    results = []
    
    # 1. System Stats
    results.append(test_endpoint("GET", "/system/stats", description="System Stats (REST placeholder)"))
    
    # 2. Config Management
    results.append(test_endpoint("GET", "/config/list", description="List Configs"))
    
    # Create a test config
    test_config = {
        "database": {"type": "mysql", "host": "localhost"},
        "model": {"name": "TestModel", "type": "classification"}
    }
    results.append(test_endpoint("POST", "/config/test_verify.yaml", data={"content": test_config}, description="Create Config"))
    results.append(test_endpoint("GET", "/config/test_verify.yaml", description="Get Config"))
    
    # 3. Files (Code Editor)
    results.append(test_endpoint("GET", "/files/read?path=src/features/preprocess.py", description="Read File"))
    
    # 4. Scheduler
    results.append(test_endpoint("GET", "/scheduler/jobs", description="List Jobs"))
    
    # 5. Training (Dry Run - just check if endpoint exists/validates)
    # We expect 404 if config doesn't exist, or 200 if it triggers background task
    # We'll use the test config we just created
    results.append(test_endpoint("POST", "/train", data={"config_path": "config/test_verify.yaml"}, description="Trigger Training"))

    print("\n" + "="*50)
    print("Verification Summary")
    print("="*50)
    
    passed = sum(1 for r in results if r[0])
    total = len(results)
    avg_latency = sum(r[1] for r in results) / total if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed:      {passed}")
    print(f"Failed:      {total - passed}")
    print(f"Avg Latency: {avg_latency:.2f}ms")
    
    if passed == total:
        print("\n✅ SYSTEM HEALTHY")
    else:
        print("\n❌ SYSTEM ISSUES DETECTED")

if __name__ == "__main__":
    run_verification()
