import subprocess
import re
import time
import os
import sys

def kill_port_8000():
    print("Finding process on port 8001 using netstat...")
    try:
        output = subprocess.check_output("netstat -ano | findstr :8001", shell=True).decode()
        print("Netstat output:")
        print(output)
        
        pids = set()
        for line in output.splitlines():
            parts = line.split()
            if len(parts) >= 5:
                pid = parts[-1]
                pids.add(pid)
        
        if not pids:
            print("No PIDs found on port 8001.")
            return

        for pid in pids:
            if pid == "0": continue
            print(f"Killing PID {pid}...")
            os.system(f"taskkill /F /PID {pid}")
            
        time.sleep(2)
        
    except subprocess.CalledProcessError:
        print("No process found on port 8001 (netstat returned error).")

def start_api():
    print("Starting API...")
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    
    # Start in background and redirect output
    with open("api_8001.log", "w") as log_file:
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8001"],
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT
        )
    print("API started (logging to api_8001.log).")

if __name__ == "__main__":
    kill_port_8000()
    start_api()
