import subprocess
import os
import sys

def start_api():
    print("Starting API on port 8001...")
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
    print("API started on port 8001 (logging to api_8001.log).")

if __name__ == "__main__":
    start_api()
